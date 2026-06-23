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
 * Fake implementation of vscode.SecretStorage that only keeps data in memory.
 *
 * For the real implementation see:
 * google3/third_party/vscode/src/vs/workbench/api/common/extHostSecrets.ts
 */
export class FakeSecretStorage implements vscode.SecretStorage {
  private readonly map = new Map<string, string>();

  private readonly onDidChangeEmitter =
    new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  async keys(): Promise<string[]> {
    return Array.from(this.map.keys());
  }

  async get(key: string): Promise<string | undefined> {
    return this.map.get(key);
  }

  async store(key: string, value: string) {
    this.map.set(key, value);
    this.onDidChangeEmitter.fire({key});
  }

  async delete(key: string) {
    this.map.delete(key);
    this.onDidChangeEmitter.fire({key});
  }
}
