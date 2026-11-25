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
import {Api, CommitId, OperationId} from '../../api/api';
import {logAndShowInternalError} from '../../logging/logging';
import {HashMap} from '../../utils/hashmap';
import {BaseFileSystemProvider} from './base_file_system_provider';

interface EmittedFile {
  // VSCode uses mtime to determine whether a file needs to be refreshed. We
  // create a fake mtime and increase it by 1 whenever the file changes.
  mtime: number;

  // TODO: kevincliao - we can store the previous file hashes here to avoid
  // refreshing the file if it hasn't changed.
}

/**
 * Returns the file's state at the working copy parent commit(s). If there are
 * multiple parents, the file system will return the *merged state* of the
 * parents.  e.g. If working copy commit A has parents B, C and D, this returns
 * the file's state at B + C + D. If commit A just has a single parent B, then
 * the file's state at B is returned. If the working copy commit has changed,
 * this file system will also refresh the displayed file contents to reflect the
 * new state.
 *
 * The jj-working-copy-parent file system only reads the path, and does not
 * support any query parameters.
 *    e.g. jj-working-copy-parent://<path>
 *
 * Note that this file system provider does not support returning the latest
 * state of the working copy. That is handled by the Cider-provided CitC file
 * system.
 *
 * path: The full path of the file. e.g. /google/src/cloud/user/ws/google3/path/to/file
 */
export class WorkingCopyParentFileSystemProvider extends BaseFileSystemProvider {
  // The working copy commit id and op head. If undefined, the repo is not
  // initialized yet.
  private wcCommitId: CommitId | undefined;
  private opHead: OperationId | undefined;

  // Stores the emitted files. This is used to determine whether a file needs to
  // be refreshed.
  private readonly emittedFiles = new HashMap<vscode.Uri, EmittedFile>();
  private isDisposed = false;

  constructor(private readonly api: Api) {
    super();
    this.api.onStateChanged(
      () => this.onStateChanged(),
      this,
      this.disposables,
    );
    void this.onStateChanged();
  }

  override stat(uri: vscode.Uri): vscode.FileStat {
    const file = this.putIfAbsent(uri);
    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: file.mtime,
      size: 0,
    };
  }

  override async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    this.putIfAbsent(uri);
    const commitId = this.wcCommitId;
    const opHead = this.opHead;
    if (commitId === undefined || opHead === undefined) {
      // State is not fully initialized yet. Return a blank file for now. It
      // will be invalidated upon `onStateChanged`.
      return new Uint8Array(0);
    }
    const result = await this.api.readFileAtCommit(
      commitId,
      opHead,
      vscode.workspace.asRelativePath(uri.path),
      {showParent: true},
    );
    if (result === undefined) {
      // Most likely a new file - not an error.
      return new Uint8Array(0);
    }
    return result;
  }

  private async onStateChanged() {
    let repoState;
    try {
      repoState = await this.api.getRepoState();
    } catch (e: unknown) {
      if (this.isDisposed) {
        return;
      }
      throw e;
    }
    if (this.isDisposed) {
      return;
    }
    const {commits, opHead} = repoState;
    if (commits.length === 0) {
      // State is not fully initialized yet.
      return;
    }
    const wcCommit = commits.find((commit) => commit.active);
    if (wcCommit === undefined) {
      throw logAndShowInternalError(
        'no working copy commit found in repo state',
      );
    }
    if (wcCommit.id.hex === this.wcCommitId?.hex) {
      return;
    }
    this.wcCommitId = wcCommit.id;
    this.opHead = opHead;

    // TODO: kevincliao - we can avoid emitting file change events for files
    // that haven't changed.
    for (const file of this.emittedFiles.values()) {
      file.mtime += 1;
    }

    const fileChangeEvents: vscode.FileChangeEvent[] = [];
    for (const uri of this.emittedFiles.keys()) {
      fileChangeEvents.push({uri, type: vscode.FileChangeType.Changed});
    }

    if (fileChangeEvents.length > 0) {
      this.onDidChangeFileEmitter.fire(fileChangeEvents);
    }
  }

  /**
   * Adds the provided uri into the emitted files map if it does not exist.
   */
  private putIfAbsent(uri: vscode.Uri): EmittedFile {
    let file = this.emittedFiles.get(uri);
    if (file === undefined) {
      file = {
        mtime: 0,
      };
      this.emittedFiles.set(uri, file);
    }
    return file;
  }

  override dispose() {
    this.isDisposed = true;
    super.dispose();
  }
}
