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

export class FakeExtension implements vscode.Extension<void> {
  id = 'fake-extension-id';
  readonly packageJSON: unknown = {};

  constructor({id, packageJSON}: {id?: string; packageJSON?: unknown} = {}) {
    this.id = id ?? this.id;
    this.packageJSON = packageJSON ?? this.packageJSON;
  }

  get extensionUri() {
    return unimplemented(this.constructor.name, 'extensionUri');
  }

  get extensionPath() {
    return unimplemented(this.constructor.name, 'extensionPath');
  }

  get isActive() {
    return unimplemented(this.constructor.name, 'isActive');
  }

  get extensionKind() {
    return unimplemented(this.constructor.name, 'extensionKind');
  }

  get exports() {
    return unimplemented(this.constructor.name, 'exports');
  }

  activate() {
    return unimplemented(this.constructor.name, 'activate');
  }
}
