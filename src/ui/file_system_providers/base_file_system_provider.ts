/**
 * @license
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
import {logAndShowInternalError} from '../../logging/logging';
import {dispose} from '../../utils/dispose';

/**
 * Base class for file system providers.
 *
 * An abstract class for unused/noop methods in jj's file system providers.
 */
export abstract class BaseFileSystemProvider
  implements vscode.FileSystemProvider, vscode.Disposable
{
  protected readonly disposables: vscode.Disposable[] = [];

  readonly onDidChangeFileEmitter = new vscode.EventEmitter<
    vscode.FileChangeEvent[]
  >();
  readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

  constructor() {
    this.disposables.push(this.onDidChangeFileEmitter);
  }

  abstract stat(uri: vscode.Uri): vscode.FileStat | Promise<vscode.FileStat>;

  abstract readFile(uri: vscode.Uri): Uint8Array | Promise<Uint8Array>;

  watch(
    _uri: vscode.Uri,
    _options: {
      readonly recursive: boolean;
      readonly excludes: readonly string[];
    },
  ): vscode.Disposable {
    return {
      dispose: () => {},
    };
  }

  readDirectory(
    _uri: vscode.Uri,
  ):
    | Array<[string, vscode.FileType]>
    | Thenable<Array<[string, vscode.FileType]>> {
    throw logAndShowInternalError(
      'readDirectory not implemented in BaseFileSystemProvider',
    );
  }

  writeFile(
    _uri: vscode.Uri,
    _content: Uint8Array,
    _options: {
      readonly create: boolean;
      readonly overwrite: boolean;
    },
  ): void | Thenable<void> {
    throw logAndShowInternalError(
      'writeFile not implemented in BaseFileSystemProvider',
    );
  }

  createDirectory(_uri: vscode.Uri): void {
    throw logAndShowInternalError(
      'createDirectory not implemented in BaseFileSystemProvider',
    );
  }

  delete(_uri: vscode.Uri, _options: {readonly recursive: boolean}): void {
    throw logAndShowInternalError(
      'delete not implemented in BaseFileSystemProvider',
    );
  }

  rename(
    _oldUri: vscode.Uri,
    _newUri: vscode.Uri,
    _options: {
      readonly overwrite: boolean;
    },
  ): void {
    throw logAndShowInternalError(
      'rename not implemented in BaseFileSystemProvider',
    );
  }

  dispose() {
    dispose(this.disposables);
  }
}
