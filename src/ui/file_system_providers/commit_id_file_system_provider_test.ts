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
import {SubprocessClient} from '../../client/subprocess_client';
import {installVscode} from '../../testing/install_vscode';
import {newRepo} from '../../testing/new_repo';

const decode = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);

describe('CommitIdFileSystemProvider', () => {
  const {jj, repo, writeFile, getWcCommitId, activate} = newRepo();

  beforeEach(async () => {
    installVscode();
    await activate();
  });

  it('stat returns constant file stat', async () => {
    const commitId = await getWcCommitId();
    const uri = vscode.Uri.from({
      scheme: 'jj-commits',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: `commitId=${commitId}`,
    });

    await expectAsync(vscode.workspace.fs.stat(uri)).toBeResolvedTo({
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0,
    });
  });

  it('readFile reads file at the specified commitId', async () => {
    writeFile('dir/file.txt', 'file-contents');
    const commitId = await getWcCommitId();
    const uri = vscode.Uri.from({
      scheme: 'jj-commits',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: `commitId=${commitId}`,
    });

    expect(decode(await vscode.workspace.fs.readFile(uri))).toEqual(
      'file-contents',
    );
  });

  it('readFile passes opId when specified in query params', async () => {
    writeFile('dir/file.txt', 'unpublished-contents');
    const client = new SubprocessClient(repo.workspaceRoot);
    const state = await client.getWorkspaceState();
    const wc = state.commits.find((c) => c.active)!;
    const uri = vscode.Uri.from({
      scheme: 'jj-commits',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: `commitId=${wc.id.hex}&opId=${state.opHead.hex}`,
    });

    expect(decode(await vscode.workspace.fs.readFile(uri))).toEqual(
      'unpublished-contents',
    );
  });

  it('readFile queries parent commits when showParents is set', async () => {
    writeFile('dir/file.txt', 'parent-contents');
    await jj('new');
    writeFile('dir/file.txt', 'child-contents');
    const commitId = await getWcCommitId();
    const uri = vscode.Uri.from({
      scheme: 'jj-commits',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: `commitId=${commitId}&showParents`,
    });

    expect(decode(await vscode.workspace.fs.readFile(uri))).toEqual(
      'parent-contents',
    );
  });

  it('readFile returns empty bytes when file does not exist at commit', async () => {
    const commitId = await getWcCommitId();
    const uri = vscode.Uri.from({
      scheme: 'jj-commits',
      path: `${repo.workspaceRoot}/dir/new_file.txt`,
      query: `commitId=${commitId}`,
    });

    await expectAsync(vscode.workspace.fs.readFile(uri)).toBeResolvedTo(
      new Uint8Array(0),
    );
  });

  it('readFile throws an error when commitId is missing or empty', async () => {
    const missingCommitIdUri = vscode.Uri.from({
      scheme: 'jj-commits',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: 'showParents',
    });
    const emptyCommitIdUri = vscode.Uri.from({
      scheme: 'jj-commits',
      path: `${repo.workspaceRoot}/dir/file.txt`,
      query: 'commitId=',
    });

    await expectAsync(
      vscode.workspace.fs.readFile(missingCommitIdUri),
    ).toBeRejectedWithError(
      /commitId arg must be set for jj-commits:\/\/ file system/,
    );
    await expectAsync(
      vscode.workspace.fs.readFile(emptyCommitIdUri),
    ).toBeRejectedWithError(
      /commitId arg must be set for jj-commits:\/\/ file system/,
    );
  });
});
