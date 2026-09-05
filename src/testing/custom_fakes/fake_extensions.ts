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

import * as vscode from 'vscode';

export class FakeExtensions {
  all: vscode.Extension<unknown>[] = [];

  readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  get allAcrossExtensionHosts(): vscode.Extension<unknown>[] {
    return this.all;
  }

  getExtension<T>(extensionId: string): vscode.Extension<T> | undefined {
    return this.all.find((ext) => ext.id === extensionId) as
      | vscode.Extension<T>
      | undefined;
  }
}
