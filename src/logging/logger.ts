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
 * A generic logging interface.
 */
export interface Logger {
  /**
   * Logs a provided message at the info level.
   */
  info(message: string): void;

  /**
   * Logs a provided message at the error level.
   *
   * @param message The message to log.
   * @param args Additional arguments to log.
   */
  error(message: string | Error, ...args: unknown[]): void;
}
