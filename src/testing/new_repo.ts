/**
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

/// <reference types="node" />

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {subprocess} from '../client/subprocess_util';

/**
 * Callers may destructure the response at `describe` time, before
 * `beforeEach` or `it` is invoked. So the variables returned in this
 * interface must not be primitives like string or number, since those
 * will be captured at `describe` time and be stale.
 */
export interface NewRepoResponse {
  repo: TestRepo;

  /** Runs `jj` subprocess inside the provided test repo. */
  jj: (...args: string[]) => Promise<{stdout: string; stderr: string}>;

  /** File system operations to the repo. */
  writeFile: (relativePath: string, contents: string) => void;
  removeFile: (relativePath: string) => void;

  /** Getting the current commit's ids. */
  getWcChangeId: () => Promise<string>;
}

export function newRepo(): NewRepoResponse {
  const repo = new TestRepo('');

  beforeEach(async () => {
    repo.workspaceRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'jj-dojo-test-')),
    );
    await subprocess({
      cwd: repo.workspaceRoot,
      command: 'jj',
      args: ['git', 'init'],
    });
  });

  afterEach(() => {
    if (repo.workspaceRoot && fs.existsSync(repo.workspaceRoot)) {
      fs.rmSync(repo.workspaceRoot, {recursive: true, force: true});
    }
  });
  return createNewRepoResponse(repo);
}

function createNewRepoResponse(repo: TestRepo): NewRepoResponse {
  const jj = async (...args: string[]) => {
    return await subprocess({
      cwd: repo.workspaceRoot,
      command: 'jj',
      args,
    });
  };

  const writeFile = (relativePath: string, contents: string) => {
    const filePath = path.join(repo.workspaceRoot, relativePath);
    fs.writeFileSync(filePath, contents);
  };

  const removeFile = (relativePath: string) => {
    const filePath = path.join(repo.workspaceRoot, relativePath);
    fs.unlinkSync(filePath);
  };

  const getWcChangeId = async () => {
    return (
      await jj(
        'log',
        '-T',
        'change_id',
        '-r',
        '@',
        '--no-graph',
        '--color=never',
      )
    ).stdout.trim();
  };

  return {
    repo,
    jj,
    writeFile,
    removeFile,
    getWcChangeId,
  };
}

export class TestRepo {
  constructor(public workspaceRoot: string) {}
}
