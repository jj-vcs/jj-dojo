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

import type * as vscode from 'vscode';
import {unimplemented} from './unimplemented';

export class FakeLogOutputChannel implements vscode.LogOutputChannel {
  readonly messages: Array<['INFO' | 'ERROR', ...Array<unknown>]> = [];

  constructor(readonly name: string) {}

  get logLevel() {
    return unimplemented(this.constructor.name, 'logLevel');
  }

  get onDidChangeLogLevel() {
    return unimplemented(this.constructor.name, 'onDidChangeLogLevel');
  }

  trace() {
    return unimplemented(this.constructor.name, 'trace');
  }

  debug() {
    return unimplemented(this.constructor.name, 'debug');
  }

  info(message: string, ...args: unknown[]) {
    this.messages.push(['INFO', message, ...args]);
  }

  warn() {
    return unimplemented(this.constructor.name, 'warn');
  }

  /**
   * Outputs the given error or error message to the channel.
   *
   * The message is only logged if the channel is configured to display {@link LogLevel.Error error} log level or lower.
   *
   * @param error Error or error message to log
   */
  error(error: string | Error, ...args: unknown[]) {
    if (error instanceof Error) {
      error = error.message;
    }
    this.messages.push(['ERROR', error, ...args]);
  }

  append() {
    return unimplemented(this.constructor.name, 'append');
  }

  appendLine() {
    return unimplemented(this.constructor.name, 'appendLine');
  }

  replace() {
    return unimplemented(this.constructor.name, 'replace');
  }

  clear() {
    return unimplemented(this.constructor.name, 'clear');
  }

  show() {
    return unimplemented(this.constructor.name, 'show');
  }

  hide() {
    return unimplemented(this.constructor.name, 'hide');
  }

  dispose() {}
}
