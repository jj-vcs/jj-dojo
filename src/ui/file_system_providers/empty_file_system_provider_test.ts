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

import 'jasmine';
import * as vscode from 'vscode';
import {installVscode} from '../../testing/install_vscode';
import {EmptyFileSystemProvider} from './empty_file_system_provider';

describe('EmptyFileSystemProvider', () => {
  let provider: EmptyFileSystemProvider;
  let uri: vscode.Uri;

  beforeEach(() => {
    installVscode();
    provider = new EmptyFileSystemProvider();
    uri = vscode.Uri.parse('jj-empty:/dir/file.txt');
  });

  afterEach(() => {
    provider.dispose();
  });

  it('returns a zeroed FileStat for stat()', () => {
    expect(provider.stat(uri)).toEqual({
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0,
    });
  });

  it('returns an empty Uint8Array(0) for readFile()', () => {
    expect(provider.readFile(uri)).toEqual(new Uint8Array(0));
  });

  it('returns a disposable for watch()', () => {
    const watcher = provider.watch(uri, {recursive: false, excludes: []});
    expect(() => watcher.dispose()).not.toThrow();
  });

  it('throws on unimplemented BaseFileSystemProvider write and directory operations', () => {
    expect(() => provider.readDirectory(uri)).toThrowError(
      /readDirectory not implemented in BaseFileSystemProvider/,
    );
    expect(() =>
      provider.writeFile(uri, new Uint8Array(0), {
        create: true,
        overwrite: true,
      }),
    ).toThrowError(/writeFile not implemented in BaseFileSystemProvider/);
    expect(() => provider.createDirectory(uri)).toThrowError(
      /createDirectory not implemented in BaseFileSystemProvider/,
    );
    expect(() => provider.delete(uri, {recursive: false})).toThrowError(
      /delete not implemented in BaseFileSystemProvider/,
    );
    expect(() =>
      provider.rename(uri, vscode.Uri.parse('jj-empty:/dir/other.txt'), {
        overwrite: true,
      }),
    ).toThrowError(/rename not implemented in BaseFileSystemProvider/);
  });

  it('disposes the onDidChangeFileEmitter when disposed', () => {
    const listener = jasmine.createSpy('onDidChangeFile');
    provider.onDidChangeFile(listener);

    provider.dispose();
    provider.onDidChangeFileEmitter.fire([]);

    expect(listener).not.toHaveBeenCalled();
  });
});
