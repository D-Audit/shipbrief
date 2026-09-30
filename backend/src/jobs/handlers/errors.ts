/** Throw from a job handler when retrying cannot help (e.g. the target row was deleted). */
export class NonRetryableJobError extends Error {
  override name = "NonRetryableJobError";
}
