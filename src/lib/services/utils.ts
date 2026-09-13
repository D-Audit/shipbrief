const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export async function withMockDelay<T>(fn: () => T, ms = 400): Promise<T> {
  await delay(ms);
  return fn();
}

export async function withMockError<T>(
  fn: () => T,
  shouldFail = false,
  errorMessage = "Something went wrong"
): Promise<T> {
  await delay(400);
  if (shouldFail) throw new Error(errorMessage);
  return fn();
}
