/**
 * A generic logging interface.
 */
export interface Logger {
  /**
   * Logs a provided message at the info level.
   */
  info(message: string | Error): void;

  /**
   * Logs a provided message at the error level.
   */
  error(message: string | Error): void;
}
