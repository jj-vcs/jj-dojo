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
 * Fake implementation of vscode.EnvironmentVariableCollection that doesn't
 * interact with anything.
 *
 * For the real implementation see
 * google3/third_party/vscode/src/vs/workbench/api/common/extHostTerminalService.ts
 */
export class FakeEnvironmentVariableCollection
  implements vscode.EnvironmentVariableCollection
{
  private readonly map = new Map<string, vscode.EnvironmentVariableMutator>();

  description: string | vscode.MarkdownString | undefined;
  persistent = true;

  replace(
    variable: string,
    value: string,
    options?: vscode.EnvironmentVariableMutatorOptions,
  ) {
    this.map.set(variable, {
      value,
      options: options ?? {},
      type: vscode.EnvironmentVariableMutatorType.Replace,
    });
  }

  append(
    variable: string,
    value: string,
    options?: vscode.EnvironmentVariableMutatorOptions,
  ) {
    this.map.set(variable, {
      value,
      options: options ?? {},
      type: vscode.EnvironmentVariableMutatorType.Append,
    });
  }

  prepend(
    variable: string,
    value: string,
    options?: vscode.EnvironmentVariableMutatorOptions,
  ) {
    this.map.set(variable, {
      value,
      options: options ?? {},
      type: vscode.EnvironmentVariableMutatorType.Prepend,
    });
  }

  get(variable: string): vscode.EnvironmentVariableMutator | undefined {
    return this.map.get(variable);
  }

  forEach(
    callback: (
      variable: string,
      mutator: vscode.EnvironmentVariableMutator,
      collection: vscode.EnvironmentVariableCollection,
    ) => void,
    thisArg?: unknown,
  ) {
    this.map.forEach((value, key) => {
      callback.call(thisArg, key, value, this);
    });
  }

  [Symbol.iterator](): IterableIterator<
    [variable: string, mutator: vscode.EnvironmentVariableMutator]
  > {
    return this.map.entries();
  }

  delete(variable: string) {
    this.map.delete(variable);
  }

  clear() {
    this.map.clear();
  }
}

/** Fake implementation of vscode.GlobalEnvironmentVariableCollection. */
export class FakeGlobalEnvironmentVariableCollection
  extends FakeEnvironmentVariableCollection
  implements vscode.GlobalEnvironmentVariableCollection
{
  getScoped() {
    return this;
  }
}
