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
import {Api, FileId} from '../../api/api';
import {logAndShowInternalError} from '../../logging/logging';
import {BaseFileSystemProvider} from './base_file_system_provider';

/**
 * Provides contents of files for given file ids when given URIs of the form
 * 'jj-file-id://'.
 *
 * The jj-file-id file system allows the following url patterns:
 *  - Specifying the file id.
 *    e.g. jj-file-id://<path>?fileId=<fileId>
 *    This returns the contents of the file at the specified file id.
 *
 * path: The full path of the file. e.g. /path/to/workspace/dir/file.txt
 */
export class FileIdFileSystemProvider extends BaseFileSystemProvider {
  constructor(private readonly api: Api) {
    super();
  }

  override stat(_uri: vscode.Uri): vscode.FileStat {
    return {
      type: vscode.FileType.File,
      ctime: 0,
      // VSCode uses mtime to determine whether a file needs to be refreshed.
      // Since the jj-file-id file system just returns the file's state at the
      // specified file id it never needs to be refreshed.
      mtime: 0,
      size: 0,
    };
  }

  override async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const args = parseUri(uri);
    return this.api.readFileById(args.fileId, args.workspacePath);
  }
}

interface Args {
  fileId: FileId;
  workspacePath: string;
}

/**
 * Parses the query params from the jj-file-id:// file system uri. See
 * `FileIdFileSystemProvider` for the supported query params.
 *
 * @param uri The uri to parse.
 * @return The parsed args.
 */
function parseUri(uri: vscode.Uri): Args {
  const params: URLSearchParams = new URLSearchParams(uri.query);
  const fileIdStr = params.get('fileId');
  if (!fileIdStr) {
    throw logAndShowInternalError(
      'fileId arg must be set for jj-file-id:// file system',
    );
  }
  return {
    fileId: new FileId(fileIdStr),
    workspacePath: vscode.workspace.asRelativePath(uri.path, false),
  };
}
