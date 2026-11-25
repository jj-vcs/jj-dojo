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

import 'jasmine';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {ModificationType} from '../api/api';
import {SubprocessClient} from '../client/subprocess_client';
import {LocalFileSystemWatcher} from '../file_system_watcher/local_file_system_watcher';
import {removeGlobalLogger, setGlobalLogger} from '../logging/logging';
import {OutputChannelLogger} from '../logging/output_channel_logger';
import {installVscode} from '../testing/install_vscode';
import {newRepo} from '../testing/new_repo';
import {ApiStateManager} from './api_state_manager';

const activeIntervals = new Set<ReturnType<typeof setInterval>>();

function waitForCondition(
  predicate: () => boolean,
  description: string,
): Promise<void> {
  const timeoutMs = 30000;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval);
        activeIntervals.delete(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        activeIntervals.delete(interval);
        reject(new Error(`Timeout waiting for condition: ${description}`));
      }
    }, 50);
    activeIntervals.add(interval);
  });
}

describe('ApiStateManager with SubprocessClient, LocalFileSystemWatcher, and real jj CLI', () => {
  const {jj, repo, writeFile} = newRepo();
  let watcherInstance: LocalFileSystemWatcher | undefined;
  let manager: ApiStateManager | undefined;
  let onDidChangeEmitter: vscode.EventEmitter<void> | undefined;

  beforeEach(() => {
    installVscode();
    setGlobalLogger(new OutputChannelLogger());
  });

  afterEach(async () => {
    for (const interval of activeIntervals) {
      clearInterval(interval);
    }
    activeIntervals.clear();
    if (manager !== undefined) {
      manager.dispose();
      await manager.waitForIdle();
      manager = undefined;
    }
    if (watcherInstance !== undefined) {
      await watcherInstance.dispose();
      watcherInstance = undefined;
    }
    onDidChangeEmitter?.dispose();
    onDidChangeEmitter = undefined;
    removeGlobalLogger();
  });

  it('tracks file edits, .gitignore watcher restarts, jj new checkouts, and sibling-workspace refresh()', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    watcherInstance = new LocalFileSystemWatcher(repo.workspaceRoot);
    await watcherInstance._testOnlyParcelSubscription;

    onDidChangeEmitter = new vscode.EventEmitter<void>();
    manager = new ApiStateManager({
      client,
      onDidChangeEmitter,
      fileSystemWatcher: watcherInstance,
    });

    await manager.init();
    expect(await manager.waitUntilInitialized()).toBeTrue();

    // 1. Write a tracked file and wait for authoritative ADDED state with resolved FileId.
    writeFile('feature.ts', 'export const v = 1;\n');
    await waitForCondition(() => {
      const wc = manager
        ?.getRepoAndWorkingCopyState()
        ?.repoState.commits.find((c) => c.active);
      const file = wc?.files.find((f) => f.path === 'feature.ts');
      return (
        file?.modificationType === ModificationType.ADDED &&
        file.mergedFileMetadata.asResolved()?.fileId !== undefined
      );
    }, 'authoritative ADDED state for feature.ts');

    // 2. Write root .gitignore with a top-level ignored directory to trigger
    // native @parcel/watcher re-subscription (`undefined` rescan) and verify
    // subsequent file edits continue advancing state cleanly.
    writeFile('.gitignore', 'ignored_out/\n');
    writeFile('ignored_out/noise.txt', 'ignored');
    writeFile('after_gitignore.ts', 'export const ok = true;\n');
    await waitForCondition(() => {
      const wc = manager
        ?.getRepoAndWorkingCopyState()
        ?.repoState.commits.find((c) => c.active);
      const hasAfter = wc?.files.some(
        (f) =>
          f.path === 'after_gitignore.ts' &&
          f.modificationType === ModificationType.ADDED,
      );
      const hasIgnored = wc?.files.some((f) =>
        f.path.startsWith('ignored_out'),
      );
      return Boolean(hasAfter) && !hasIgnored;
    }, 'post-.gitignore restart file state');

    // 3. Run `jj new -m` in primary workspace -> checkout change updates active commit.
    await jj('new', '-m', 'second commit in primary');
    await waitForCondition(() => {
      const wc = manager
        ?.getRepoAndWorkingCopyState()
        ?.repoState.commits.find((c) => c.active);
      return wc?.description.trim() === 'second commit in primary';
    }, 'jj new checkout update');

    // 4. Create sibling workspace `ws2` and run `jj describe -R ws2` (mutates
    // shared repo op_heads without touching primary `.jj/working_copy/checkout`),
    // then verify `manager.refresh()` updates primary state.
    const secondaryParent = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'jj-dojo-api-state-ws2-')),
    );
    const secondaryPath = path.join(secondaryParent, 'ws2');
    try {
      const addedWs = await client.workspaceAdd(secondaryPath);
      expect(addedWs.workspaceRoot).toBeDefined();

      await jj(
        'describe',
        '-R',
        addedWs.workspaceRoot!,
        '-m',
        'sibling workspace description',
      );
      await manager.refresh();

      const commits =
        manager.getRepoAndWorkingCopyState()?.repoState.commits ?? [];
      expect(
        commits.some(
          (c) => c.description.trim() === 'sibling workspace description',
        ),
      ).toBeTrue();
    } finally {
      fs.rmSync(secondaryParent, {recursive: true, force: true});
    }
  }, 30000);
});
