/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

type Command = (...args: unknown[]) => unknown;

export class FakeCommands {
  readonly commands: Map<string, Command> = new Map();

  registerCommand(name: string, cb: Command) {
    if (this.commands.has(name)) {
      throw new Error(`Command ${name} already registered in tests`);
    }
    this.commands.set(name, cb);
  }

  executeCommand(name: string, ...args: unknown[]) {
    const cb = this.commands.get(name);
    if (!cb) {
      throw new Error(`Command ${name} not registered in tests`);
    }
    return cb(...args);
  }
}
