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
import {FileId} from '../../api/api';
import {SubprocessClient} from '../../client/subprocess_client';
import {installVscode} from '../../testing/install_vscode';
import {newRepo} from '../../testing/new_repo';

const decode = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);

describe('FileIdFileSystemProvider', () => {
  const {repo, writeFile, activate} = newRepo();

  beforeEach(async () => {
    installVscode();
    await activate();
  });

  async function getWcFileId(relativePath: string): Promise<FileId> {
    const client = new SubprocessClient(repo.workspaceRoot);
    const state = await client.getWorkspaceState();
    const wcCommit = state.commits.find((c) => c.active)!;
    const file = wcCommit.files.find((f) => f.path === relativePath);
    const fileId = file?.mergedFileMetadata.asResolved()?.fileId;
    if (!fileId) {
      throw new Error(`Failed to find FileId for: ${relativePath}`);
    }
    return fileId;
  }

  it('stat returns constant file stat', async () => {
    writeFile('dir/file.txt', 'file-contents');
    const fileId = await getWcFileId('dir/file.txt');
    const uri = vscode.Uri.from({
      scheme: 'jj-file-id',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: `fileId=${fileId}`,
    });

    await expectAsync(vscode.workspace.fs.stat(uri)).toBeResolvedTo({
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0,
    });
  });

  it('readFile reads file at the specified fileId', async () => {
    writeFile('dir/file.txt', 'v1-contents');
    const v1FileId = await getWcFileId('dir/file.txt');
    writeFile('dir/file.txt', 'v2-contents');
    const v2FileId = await getWcFileId('dir/file.txt');

    const v1Uri = vscode.Uri.from({
      scheme: 'jj-file-id',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: `fileId=${v1FileId}`,
    });
    const v2Uri = vscode.Uri.from({
      scheme: 'jj-file-id',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: `fileId=${v2FileId}`,
    });

    expect(decode(await vscode.workspace.fs.readFile(v1Uri))).toEqual(
      'v1-contents',
    );
    expect(decode(await vscode.workspace.fs.readFile(v2Uri))).toEqual(
      'v2-contents',
    );
  });

  it('readFile throws an error when fileId is missing or empty', async () => {
    const missingFileIdUri = vscode.Uri.from({
      scheme: 'jj-file-id',
      path: `${repo.workspaceRoot}/dir/file.txt`,
    });
    const emptyFileIdUri = vscode.Uri.from({
      scheme: 'jj-file-id',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: 'fileId=',
    });

    await expectAsync(
      vscode.workspace.fs.readFile(missingFileIdUri),
    ).toBeRejectedWithError(
      /fileId arg must be set for jj-file-id:\/\/ file system/,
    );
    await expectAsync(
      vscode.workspace.fs.readFile(emptyFileIdUri),
    ).toBeRejectedWithError(
      /fileId arg must be set for jj-file-id:\/\/ file system/,
    );
  });
});
