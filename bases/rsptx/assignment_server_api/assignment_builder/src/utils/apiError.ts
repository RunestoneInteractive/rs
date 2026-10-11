export const isNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  (error as { status?: unknown }).status === 404;
