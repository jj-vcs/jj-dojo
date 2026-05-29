/**
 * Copyright 2026 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
    Object.setPrototypeOf(this, JjError.prototype);
  }

  getMessage(): string {
    if (this.isInternalError) {
      return `Internal Error - ${this.message}`;
    }
    return this.message;
  }

  addPrefix(prefix: string): JjError {
    if (prefix.length > 0) {
      this.message = prefix + ': ' + this.message;
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
