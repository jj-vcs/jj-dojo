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

import {SubprocessClient} from './subprocess_client';
import {newRepo} from '../testing/new_repo';

describe('SubprocessClient', () => {
  const {jj, repo, writeFile, removeFile, getWcChangeId} = newRepo();

  it('fetches repo state after jj git init', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const state = await client.getWorkspaceState();

    // jj git init creates the initial working copy commit on top of root()
    expect(state.commits.length).toBe(2);

    const rootCommit = state.commits.find((c) => c.parents.length === 0)!;
    expect(rootCommit).toBeDefined();
    // The root commit's commitId and changeId are hardcoded.
    expect(rootCommit.id.hex).toBe('0000000000000000000000000000000000000000');
    expect(rootCommit.changeId.hex).toBe('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
    expect(rootCommit.parents).toEqual([]);
    expect(rootCommit.active).toBeFalse();
    expect(rootCommit.description).toBe('');
    expect(rootCommit.createdTime).toBe(0);
    expect(rootCommit.updateTime).toBe(0);
    expect(rootCommit.hasConflict).toBeFalse();
    expect(rootCommit.hasDiverged).toBeFalse();
    expect(rootCommit.displayId).toBe('zzzz');
    expect(rootCommit.highlightedDisplayIdLen).toBeGreaterThan(0);
    expect(rootCommit.changeOffset).toBeUndefined();

    const wcCommit = state.commits.find((c) => c.active)!;
    expect(wcCommit).toBeDefined();
    expect(wcCommit.id.hex).toMatch(/^[0-9a-f]{40}$/);
    expect(wcCommit.changeId.hex).toMatch(/^[0-9a-z]{32}$/);
    expect(wcCommit.parents.map((p) => p.hex)).toEqual([rootCommit.id.hex]);
    expect(wcCommit.children).toEqual([]);
    expect(wcCommit.active).toBeTrue();
    expect(wcCommit.description).toBe('');
    expect(wcCommit.createdTime).toBeGreaterThan(0);
    expect(wcCommit.updateTime).toBeGreaterThan(0);
    expect(wcCommit.hasConflict).toBeFalse();
    expect(wcCommit.hasDiverged).toBeFalse();
    expect(wcCommit.displayId.length).toBeGreaterThanOrEqual(4);
    expect(wcCommit.highlightedDisplayIdLen).toBeGreaterThan(0);
    expect(wcCommit.changeId.hex.startsWith(wcCommit.displayId)).toBeTrue();
    expect(wcCommit.changeOffset).toBeUndefined();

    // Root commit's children should point to the working copy commit
    expect(rootCommit.children.map((c) => c.hex)).toEqual([wcCommit.id.hex]);
  });

  it('fetches description after jj describe', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    await jj('describe', '-m', 'Initial commit message');

    const state = await client.getWorkspaceState();
    expect(state.commits.length).toBe(2);
    const wcCommit = state.commits.find((c) => c.active)!;
    expect(wcCommit).toBeDefined();
    expect(wcCommit.description.trim()).toBe('Initial commit message');
    expect(wcCommit.active).toBeTrue();
    expect(wcCommit.hasConflict).toBeFalse();
  });

  it('fetches repo state with divergent commits and change offset', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    await jj('describe', '-m', 'divergent version 1');
    await jj('describe', '-m', 'divergent version 2', '--at-op', '@-');

    // We should **not** need to run `jj log` here. `getWorkspaceState` should
    // be able to do an unpublished snapshot and realize there is divergence.

    const state = await client.getWorkspaceState();
    expect(state.commits.length).toBe(3);

    const divergentCommits = state.commits.filter((c) => c.hasDiverged);
    expect(divergentCommits.length).toBe(2);

    // Both commits share the same changeId but have different commitIds.
    expect(divergentCommits[0].changeId.hex).toBe(
      divergentCommits[1].changeId.hex,
    );
    expect(divergentCommits[0].id.hex).not.toBe(divergentCommits[1].id.hex);

    // Each divergent commit has a valid changeOffset.
    const commit1 = divergentCommits.find((c) => c.changeOffset === 0)!;
    const commit2 = divergentCommits.find((c) => c.changeOffset === 1)!;
    expect(commit1).toBeDefined();
    expect(commit2).toBeDefined();
    const displayIdPrefix = commit1.changeId.hex.substring(0, 4);
    expect(commit1.displayId).toBe(`${displayIdPrefix}/0`);
    expect(commit2.displayId).toBe(`${displayIdPrefix}/1`);
  });

  it('fetches repo state with conflict', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    writeFile('conflict.txt', 'content version 1');
    await jj('describe', '-m', 'base commit 1');
    const changeId1 = await getWcChangeId();

    await jj('new', 'root()');
    writeFile('conflict.txt', 'content version 2');
    await jj('describe', '-m', 'base commit 2');
    const changeId2 = await getWcChangeId();

    // Create a merge commit with conflict.
    await jj('new', changeId1, changeId2);

    const state = await client.getWorkspaceState();
    const mergeCommit = state.commits.find((c) => c.active)!;
    expect(mergeCommit).toBeDefined();
    expect(mergeCommit.hasConflict).toBeTrue();
    expect(mergeCommit.hasDiverged).toBeFalse();
    expect(mergeCommit.changeOffset).toBeUndefined();
    expect(mergeCommit.parents.length).toBe(2);
  });

  it('does not snapshot the working copy on getWorkspaceState', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const getOpLog = async () => {
      const {stdout} = await jj(
        '--no-integrate-operation',
        'op',
        'log',
        '--no-graph',
        '--color=never',
        '-T',
        'if(root, "root()", description) ++ "\\n"',
      );
      return stdout.trim().split('\n').filter(Boolean);
    };

    // 1) Checking the op log is clean and contains only N operations (where n is 2).
    await client.getWorkspaceState();
    const initialOps = await getOpLog();
    expect(initialOps.length).toBe(2);
    expect(initialOps).not.toContain('snapshot working copy');

    // 2) Write a file, and check the op log again: it should contain an additional
    // snapshot working copy operation.
    writeFile('test.txt', 'hello');
    await client.getWorkspaceState();
    const dirtyOps = await getOpLog();
    expect(dirtyOps.length).toBe(initialOps.length + 1);
    expect(dirtyOps[0]).toBe('snapshot working copy');

    // 3) Remove the file, and check the op log again: the op log should be clean now.
    removeFile('test.txt');
    await client.getWorkspaceState();
    const cleanOps = await getOpLog();
    // Since the changes have been reverted, the length of the op log should now be back
    // to `initialOps.length`.
    expect(cleanOps.length).toBe(initialOps.length);
    expect(cleanOps).toEqual(initialOps);
    expect(cleanOps).not.toContain('snapshot working copy');
  });
});
