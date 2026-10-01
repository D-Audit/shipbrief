import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../../config/env.js";

/**
 * Object storage behind one interface. `local` writes under STORAGE_LOCAL_DIR
 * and files are streamed back through the API; `s3` works with AWS S3 or any
 * S3-compatible store (R2, MinIO) via S3_ENDPOINT.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Public URL for a stored object. */
  url(key: string): string;
}

class LocalStorage implements StorageProvider {
  readonly name = "local";
  private readonly root = path.resolve(config.STORAGE_LOCAL_DIR);

  private resolve(key: string) {
    const target = path.resolve(this.root, key);
    // Keys are generated server-side, but never allow a path outside the storage root.
    if (!target.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return target;
  }

  async put(key: string, body: Buffer) {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body, { flag: "wx" });
  }

  async get(key: string) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }

  url(key: string) {
    return `/api/files/${key}`;
  }
}

class S3Storage implements StorageProvider {
  readonly name = "s3";
  private readonly client: S3Client;
  constructor(private readonly bucket: string) {
    this.client = new S3Client({
      region: config.S3_REGION ?? "us-east-1",
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: Boolean(config.S3_ENDPOINT),
      credentials: config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY ? { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY } : undefined,
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
  }

  async get(key: string) {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return result.Body ? Buffer.from(await result.Body.transformToByteArray()) : null;
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  url(key: string) {
    return config.S3_PUBLIC_URL ? `${config.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}` : `/api/files/${key}`;
  }
}

function createStorage(): StorageProvider {
  if (config.STORAGE_PROVIDER === "s3") {
    if (!config.S3_BUCKET) throw new Error("STORAGE_PROVIDER=s3 requires S3_BUCKET");
    return new S3Storage(config.S3_BUCKET);
  }
  return new LocalStorage();
}

export const storage = createStorage();
