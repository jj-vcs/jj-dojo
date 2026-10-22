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
import {BaseFileSystemProvider} from './base_file_system_provider';

/**
 * Provides contents of files in arbitrary commits when given URIs of the form 'jj-commits://'.
 *
 * The jj-commits file system allows the following url patterns:
 *  - Specifying the commit id.
 *    e.g. jj-commits://<path>?commitId=<commitId>
 *    This returns the file's state at the specified commit. If the commit has
 *    evolved, the file system will *not* attempt to follow the evolution.
 * - (Optional) Set opId to specify the operation id that can reach the commit.
 *    e.g. jj-commits://<path>?commitId=<commitId>&opId=<opId>
 * - (Optional) Set showParents to query the specified commit's parents instead
 *    of the commit itself.
 *    e.g. jj-commits://<path>?commitId=<commitId>&showParents
 *    This returns the merged file's state of all its parents. For example, if
 *    the specified commit has 3 parents, A, B, and C, the file system will
 *    return the merged file of A + B + C.
 *
 * path: The full path of the file. e.g. /path/to/workspace/dir/file.txt
 */
export class CommitIdFileSystemProvider extends BaseFileSystemProvider {
  constructor(private readonly api: Api) {
    super();
  }

  override stat(_uri: vscode.Uri): vscode.FileStat {
    return {
      type: vscode.FileType.File,
      ctime: 0,
      // VSCode uses mtime to determine whether a file needs to be refreshed.
      // Since the jj-commits file system just returns the file's state at the
      // specified commit id, it never needs to be refreshed.
      mtime: 0,
      size: 0,
    };
  }

  override async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const args = parseUri(uri);
    const result = await this.api.readFileAtCommit(
      args.commitId,
      args.opId,
      args.workspacePath,
      {showParent: args.showParents},
    );
    if (result === undefined) {
      // Most likely a new file - not an error.
      return new Uint8Array(0);
    }
    return result;
  }
}

interface Args {
  commitId: CommitId;
  opId: OperationId | undefined;
  showParents: boolean;
  workspacePath: string;
}

/**
 * Parses the query params from the jj-commits:// file system uri. See
 * `CommitIdFileSystemProvider` for the supported query params.
 *
 * @param uri The uri to parse.
 * @return The parsed args.
 */
function parseUri(uri: vscode.Uri): Args {
  const params: URLSearchParams = new URLSearchParams(uri.query);
  const commitIdStr = params.get('commitId');
  if (!commitIdStr) {
    throw logAndShowInternalError(
      'commitId arg must be set for jj-commits:// file system',
    );
  }
  const opIdStr = params.get('opId');
  const showParents = params.get('showParents') !== null;
  return {
    commitId: new CommitId(commitIdStr),
    opId: !opIdStr ? undefined : new OperationId(opIdStr),
    showParents,
    workspacePath: vscode.workspace.asRelativePath(uri.path, false),
  };
}
