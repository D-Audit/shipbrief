import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApi } from "./openapi.js";

/** `npm run openapi` — writes docs/openapi.json for tooling (Postman, codegen). Also served at GET /api/docs/openapi.json. */
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/openapi.json");
fs.writeFileSync(target, `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
console.log(`Wrote ${target}`);
process.exit(0);
