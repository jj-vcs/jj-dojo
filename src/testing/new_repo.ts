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

/// <reference types="node" />

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import {subprocess} from '../client/subprocess_util';
import {activate as activateExtension, deactivate} from '../extension';
import {FakeExtensionContext} from './fakes';
import {fakeVscode} from './install_vscode';

/**
 * Callers may destructure the response at `describe` time, before
 * `beforeEach` or `it` is invoked. So the variables returned in this
 * interface must not be primitives like string or number, since those
 * will be captured at `describe` time and be stale.
 */
export interface NewRepoResponse {
  repo: TestRepo;

  /** Activates the extension inside the provided test repo. */
  activate: (context?: FakeExtensionContext) => Promise<void>;

  /** Runs `jj` subprocess inside the provided test repo. */
  jj: (...args: string[]) => Promise<{stdout: string; stderr: string}>;

  /** File system operations to the repo. */
  writeFile: (relativePath: string, contents: string | Uint8Array) => void;
  removeFile: (relativePath: string) => void;

  /** Getting the current commit's change id. */
  getWcChangeId: () => Promise<string>;

  /** Getting the current commit's commit id. */
  getWcCommitId: () => Promise<string>;
}

export function newRepo(options?: {remote?: TestRepo}): NewRepoResponse {
  const repo = new TestRepo('');
  const activatedContexts: FakeExtensionContext[] = [];
  const response = createNewRepoResponse(repo, activatedContexts);
  const {jj} = response;

  beforeEach(async () => {
    repo.workspaceRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'jj-dojo-test-')),
    );
    if (options?.remote) {
      if (!options.remote.workspaceRoot) {
        throw new Error(
          'Remote TestRepo is not initialized. Ensure the remote newRepo() is declared before the local newRepo({remote}).',
        );
      }
      await jj('git', 'clone', options.remote.workspaceRoot, './');
    } else {
      await jj('git', 'init');
    }
  });

  afterEach(async () => {
    await deactivate();
    for (const context of activatedContexts) {
      context.dispose();
    }
    activatedContexts.length = 0;
    if (repo.workspaceRoot && fs.existsSync(repo.workspaceRoot)) {
      fs.rmSync(repo.workspaceRoot, {recursive: true, force: true});
    }
  });

  return response;
}

function createNewRepoResponse(
  repo: TestRepo,
  activatedContexts: FakeExtensionContext[],
): NewRepoResponse {
  const activate = async (
    context: FakeExtensionContext = new FakeExtensionContext(),
  ) => {
    fakeVscode().workspace.workspaceFolders = [
      {
        uri: vscode.Uri.file(repo.workspaceRoot),
        name: 'workspace',
        index: 0,
      },
    ];
    activatedContexts.push(context);
    await activateExtension(context);
  };

  const jj = async (...args: string[]) => {
    return await subprocess({
      cwd: repo.workspaceRoot,
      command: 'jj',
      args,
    });
  };

  const writeFile = (relativePath: string, contents: string | Uint8Array) => {
    const filePath = path.join(repo.workspaceRoot, relativePath);
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
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

  const getWcCommitId = async () => {
    return (
      await jj(
        'log',
        '-T',
        'commit_id',
        '-r',
        '@',
        '--no-graph',
        '--color=never',
      )
    ).stdout.trim();
  };

  return {
    repo,
    activate,
    jj,
    writeFile,
    removeFile,
    getWcChangeId,
    getWcCommitId,
  };
}

export class TestRepo {
  constructor(public workspaceRoot: string) {}
}
