/**
 * A standardized error class for all errors in this project.
 */
export class JjError extends Error {
  // List of prefixes that will be prepended to the error message.
  private readonly prefixes: string[] = [];

  // If true, the error has been shown to the user in a notification,
  // and should not be shown to the user again.
  isShownToUser?: boolean;

  // If true, the error has been logged to the Output Channel,
  // and should not be logged again.
  isLogged?: boolean;

  // If true, the request failed because the request failed to reach the server.
  isNetworkError?: boolean;

  // If true, this is a programmatic error.
  isInternalError?: boolean;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, Error.prototype);
  }

  override get message(): string {
    if (this.isInternalError) {
      return 'Internal Error - ' + this.prefixes.join(': ') + this.message;
    } else {
      return this.message;
    }
  }

  addPrefix(prefix: string): JjError {
    if (prefix.length > 0) {
      this.prefixes.unshift(prefix);
    }
    return this;
  }

  static from(error: unknown): JjError {
    if (error instanceof JjError) {
      return error;
    }
    if (typeof error === 'string') {
      return new JjError(error);
    }
    if (error instanceof Error) {
      return new JjError(error.message);
    }
    return new JjError(JSON.stringify(error));
  }
}
