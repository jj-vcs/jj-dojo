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
import {FakeExtension} from './fake_extension';
import {unimplemented} from './unimplemented';

export class FakeExtensionContext implements vscode.ExtensionContext {
  readonly subscriptions: vscode.Disposable[] = [];

  readonly extension: vscode.Extension<void>;

  get extensionUri() {
    return unimplemented(this.constructor.name, 'extensionUri');
  }

  constructor(options?: {extension: vscode.Extension<void>}) {
    this.extension = options?.extension ?? new FakeExtension({packageJSON: {}});
  }

  get workspaceState() {
    return unimplemented(this.constructor.name, 'workspaceState');
  }
  get globalState() {
    return unimplemented(this.constructor.name, 'globalState');
  }
  get secrets() {
    return unimplemented(this.constructor.name, 'secrets');
  }
  get extensionPath() {
    return unimplemented(this.constructor.name, 'extensionPath');
  }
  get environmentVariableCollection() {
    return unimplemented(
      this.constructor.name,
      'environmentVariableCollection',
    );
  }
  get asAbsolutePath() {
    return unimplemented(this.constructor.name, 'asAbsolutePath');
  }
  get storageUri() {
    return unimplemented(this.constructor.name, 'storageUri');
  }
  get storagePath() {
    return unimplemented(this.constructor.name, 'storagePath');
  }
  get globalStorageUri() {
    return unimplemented(this.constructor.name, 'globalStorageUri');
  }
  get globalStoragePath() {
    return unimplemented(this.constructor.name, 'globalStoragePath');
  }
  get logUri() {
    return unimplemented(this.constructor.name, 'logUri');
  }
  get logPath() {
    return unimplemented(this.constructor.name, 'logPath');
  }
  get extensionMode() {
    return unimplemented(this.constructor.name, 'extensionMode');
  }
  get languageModelAccessInformation() {
    return unimplemented(
      this.constructor.name,
      'languageModelAccessInformation',
    );
  }
}
