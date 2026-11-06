/** An error with an HTTP status the plugin can pass straight through. */
export class ReviewError extends Error {
  status: number;
  details?: string[];
  /** A machine-readable reason the page can act on (e.g. 'conflicts' offers the conflict editor). */
  code?: string;
  constructor(status: number, message: string, details?: string[], code?: string) {
    super(message);
    this.name = 'ReviewError';
    this.status = status;
    this.details = details;
    this.code = code;
  }
}
