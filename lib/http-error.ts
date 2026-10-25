/** Shared transport error, independent of Next request context for repository tests. */
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
