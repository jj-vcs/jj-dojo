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

import {Client} from '../client/client';
import {Api, CommitId, FileId, OperationId} from './api';

export class ApiImpl implements Api {
  constructor(private readonly client: Client) {}

  readFileAtCommit(
    commitId: CommitId,
    opId: OperationId | undefined,
    workspacePath: string,
    options: {showParent: boolean},
  ): Promise<Uint8Array | undefined> {
    return this.client.readFileAtCommit(commitId, opId, workspacePath, options);
  }

  readFileById(fileId: FileId, workspacePath: string): Promise<Uint8Array> {
    return this.client.readFileById(fileId, workspacePath);
  }
}
