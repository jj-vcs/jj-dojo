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

import * as vscode from 'vscode'; // from //third_party/vscode/src/vs:vscode

/**
 * Fake implementation of vscode.Memento that only keeps data in memory.
 *
 * For the real implementation see:
 * google3/third_party/vscode/src/vs/workbench/api/common/extHostMemento.ts
 */
export class FakeMemento implements vscode.Memento {
  private readonly map = new Map<string, unknown>();

  keys(): readonly string[] {
    return Array.from(this.map.keys());
  }
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.map.has(key) ? this.map.get(key) : defaultValue;
    return value as T;
  }

  update(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }

  setKeysForSync(_keys: string[]) {
    // no-op: The fake is not backed by storage.
  }
}
