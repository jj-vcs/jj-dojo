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

import {SubprocessClient} from './subprocess_client';
import {newRepo} from '../testing/new_repo';

describe('SubprocessClient', () => {
  const {jj, repo, writeFile, removeFile, getWcChangeId} = newRepo();

  it('fetches repo state after jj git init', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const state = await client.getWorkspaceState();

    // jj git init creates the initial working copy commit on top of root()
    expect(state.commits.length).toBe(2);

    const rootCommit = state.commits.find((c) => c.parentIds.length === 0)!;
    expect(rootCommit).toBeDefined();
    // The root commit's commitId and changeId are hardcoded.
    expect(rootCommit.id.hex).toBe('0000000000000000000000000000000000000000');
    expect(rootCommit.changeId.hex).toBe('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
    expect(rootCommit.parentIds).toEqual([]);
    expect(rootCommit.active).toBeFalse();
    expect(rootCommit.isWorkingCopyParentCommit).toBeTrue();
    expect(rootCommit.description).toBe('');
    expect(rootCommit.descriptionTitle).toBe('');
    expect(rootCommit.createdTime).toBe(0);
    expect(rootCommit.updateTime).toBe(0);
    expect(rootCommit.hasConflict).toBeFalse();
    expect(rootCommit.hasDiverged).toBeFalse();
    expect(rootCommit.displayId).toBe('zzzz');
    expect(rootCommit.highlightedDisplayIdLen).toBeGreaterThan(0);
    expect(rootCommit.bookmarks).toEqual([]);
    expect(rootCommit.changeOffset).toBeUndefined();
    expect([...rootCommit.ancestors]).toEqual([rootCommit.id]);

    const wcCommit = state.commits.find((c) => c.active)!;
    expect(wcCommit).toBeDefined();
    expect(wcCommit.id.hex).toMatch(/^[0-9a-f]{40}$/);
    expect(wcCommit.changeId.hex).toMatch(/^[0-9a-z]{32}$/);
    expect(wcCommit.parentIds.map((p) => p.hex)).toEqual([rootCommit.id.hex]);
    expect(wcCommit.childIds).toEqual([]);
    expect(wcCommit.active).toBeTrue();
    expect(wcCommit.isWorkingCopyParentCommit).toBeFalse();
    expect(wcCommit.description).toBe('');
    expect(wcCommit.descriptionTitle).toBe('');
    expect(wcCommit.createdTime).toBeGreaterThan(0);
    expect(wcCommit.updateTime).toBeGreaterThan(0);
    expect(wcCommit.hasConflict).toBeFalse();
    expect(wcCommit.hasDiverged).toBeFalse();
    expect(wcCommit.displayId.length).toBeGreaterThanOrEqual(4);
    expect(wcCommit.highlightedDisplayIdLen).toBeGreaterThan(0);
    expect(wcCommit.changeId.hex.startsWith(wcCommit.displayId)).toBeTrue();
    expect(wcCommit.bookmarks).toEqual([]);
    expect(wcCommit.changeOffset).toBeUndefined();
    expect([...wcCommit.ancestors]).toEqual(
      jasmine.arrayWithExactContents([rootCommit.id, wcCommit.id]),
    );
    expect([...wcCommit.descendants]).toEqual([wcCommit.id]);

    // Root commit's children and descendants should point to the working copy commit
    expect(rootCommit.childIds.map((c) => c.hex)).toEqual([wcCommit.id.hex]);
    expect([...rootCommit.descendants]).toEqual(
      jasmine.arrayWithExactContents([rootCommit.id, wcCommit.id]),
    );
  });

  it('fetches description after jj describe', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    await jj('describe', '-m', 'Initial commit message');

    const state = await client.getWorkspaceState();
    expect(state.commits.length).toBe(2);
    const wcCommit = state.commits.find((c) => c.active)!;
    expect(wcCommit).toBeDefined();
    expect(wcCommit.description.trim()).toBe('Initial commit message');
    expect(wcCommit.descriptionTitle).toBe('Initial commit message');
    expect(wcCommit.active).toBeTrue();
    expect(wcCommit.hasConflict).toBeFalse();
  });

  it('fetches description with binary data', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const binaryDescription =
      '\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f\x80\xfe\xff binary data';
    await jj('describe', '-m', binaryDescription);

    const state = await client.getWorkspaceState();
    expect(state.commits.length).toBe(2);
    const wcCommit = state.commits.find((c) => c.active)!;
    expect(wcCommit).toBeDefined();
    expect(wcCommit.description.trim()).toBe(binaryDescription);
    expect(wcCommit.active).toBeTrue();
    expect(wcCommit.hasConflict).toBeFalse();
  });

  it('fetches descriptionTitle for multiline description', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    await jj(
      'describe',
      '-m',
      'Initial commit title\n\nMore details on line 3\nMore details on line 4',
    );

    const state = await client.getWorkspaceState();
    const wcCommit = state.commits.find((c) => c.active)!;
    expect(wcCommit).toBeDefined();
    expect(wcCommit.descriptionTitle).toBe('Initial commit title');
    expect(wcCommit.description.trim()).toBe(
      'Initial commit title\n\nMore details on line 3\nMore details on line 4',
    );
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
    expect(mergeCommit.parentIds.length).toBe(2);
    expect(mergeCommit.isWorkingCopyParentCommit).toBeFalse();
  });

  it('snapshots the working copy without publishing an operation', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    // TODO: kevincliao - In the next PR, change getWorkspaceState to return
    // the op log, and replace getOpLog here. This ensures snapshotWithoutIntegrating
    // fails the test even if it passes --ignore-working-copy instead of --no-integrate-operation
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

  it('populates ancestors and descendants across multiple commits', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    await jj('describe', '-m', 'Initial commit');
    await jj('new', '-m', 'Commit 1');
    await jj('new', '-m', 'Commit 2');

    const state = await client.getWorkspaceState();
    const rootCommit = state.commits.find((c) => c.parentIds.length === 0)!;
    const initialCommit = state.commits.find(
      (c) => c.description.trim() === 'Initial commit',
    )!;
    const commit1 = state.commits.find(
      (c) => c.description.trim() === 'Commit 1',
    )!;
    const commit2 = state.commits.find(
      (c) => c.description.trim() === 'Commit 2',
    )!;

    expect(initialCommit).toBeDefined();
    expect(commit1).toBeDefined();
    expect(commit2).toBeDefined();

    expect([...rootCommit.ancestors]).toEqual([rootCommit.id]);
    expect([...initialCommit.ancestors]).toEqual(
      jasmine.arrayWithExactContents([rootCommit.id, initialCommit.id]),
    );
    expect([...commit1.ancestors]).toEqual(
      jasmine.arrayWithExactContents([
        rootCommit.id,
        initialCommit.id,
        commit1.id,
      ]),
    );
    expect([...commit2.ancestors]).toEqual(
      jasmine.arrayWithExactContents([
        rootCommit.id,
        initialCommit.id,
        commit1.id,
        commit2.id,
      ]),
    );

    expect([...rootCommit.descendants]).toEqual(
      jasmine.arrayWithExactContents([
        rootCommit.id,
        initialCommit.id,
        commit1.id,
        commit2.id,
      ]),
    );
    expect([...initialCommit.descendants]).toEqual(
      jasmine.arrayWithExactContents([
        initialCommit.id,
        commit1.id,
        commit2.id,
      ]),
    );
    expect([...commit1.descendants]).toEqual(
      jasmine.arrayWithExactContents([commit1.id, commit2.id]),
    );
    expect([...commit2.descendants]).toEqual([commit2.id]);
  });
});

describe('SubprocessClient with Remote Repo', () => {
  const remote = newRepo();
  const local = newRepo({remote: remote.repo});

  it('fetches local bookmark', async () => {
    const {jj, repo} = local;
    await jj('bookmark', 'set', 'localBookmark');
    const client = new SubprocessClient(repo.workspaceRoot);
    const state = await client.getWorkspaceState();

    expect(state.commits.length).toBe(2);
    const wcCommit = state.commits.find((c) => c.active)!;
    const rootCommit = state.commits.find((c) => c.parentIds.length === 0)!;

    expect(wcCommit.bookmarks).toEqual([
      {
        name: 'localBookmark',
        remote: undefined,
        needsUpload: false,
        isConflicted: false,
      },
    ]);
    expect(rootCommit.bookmarks).toHaveSize(0);
  });

  it('fetches local conflicted bookmark', async () => {
    const {jj, repo, getWcChangeId} = local;
    const c1Id = await getWcChangeId();
    await jj('describe', '-m', 'c1');
    await jj('new', 'root()');
    const c2Id = await getWcChangeId();
    await jj('describe', '-m', 'c2');

    await jj('bookmark', 'set', 'conflictedBookmark', '-r', c1Id);
    await jj('bookmark', 'set', 'conflictedBookmark', '-r', c2Id, '--at-op=@-');

    const client = new SubprocessClient(repo.workspaceRoot);
    const state = await client.getWorkspaceState();
    expect(state.commits.length).toBe(3);

    const c1 = state.commits.find((c) => c.description.includes('c1'))!;
    const c2 = state.commits.find((c) => c.description.includes('c2'))!;
    const root = state.commits.find((c) => c.parentIds.length === 0)!;

    expect(c1.bookmarks).toEqual([
      {
        name: 'conflictedBookmark',
        remote: undefined,
        needsUpload: false,
        isConflicted: true,
      },
      {
        name: 'conflictedBookmark',
        remote: 'git',
        needsUpload: false,
        isConflicted: false,
      },
    ]);
    expect(c2.bookmarks).toEqual([
      {
        name: 'conflictedBookmark',
        remote: undefined,
        needsUpload: false,
        isConflicted: true,
      },
    ]);
    expect(root.bookmarks).toEqual([]);
  });

  it('fetches local bookmark that does not need upload', async () => {
    await remote.jj('describe', '-m', 'remote commit');
    await remote.jj('bookmark', 'set', 'syncedBookmark');

    await local.jj('git', 'fetch');
    await local.jj('bookmark', 'track', 'syncedBookmark');

    const client = new SubprocessClient(local.repo.workspaceRoot);
    const state = await client.getWorkspaceState();
    const remoteCommit = state.commits.find(
      (c) => c.description.trim() === 'remote commit',
    )!;
    expect(remoteCommit.bookmarks).toEqual([
      {
        name: 'syncedBookmark',
        remote: undefined,
        needsUpload: false,
        isConflicted: false,
      },
    ]);
  });

  it('fetches local bookmark that needs upload', async () => {
    await remote.jj('describe', '-m', 'remote commit');
    await remote.jj('bookmark', 'set', 'myBookmark');

    await local.jj('git', 'fetch');
    await local.jj('bookmark', 'track', 'myBookmark');

    await local.jj('new', 'myBookmark');
    local.writeFile('file.txt', 'something');
    await local.jj('squash');

    const client = new SubprocessClient(local.repo.workspaceRoot);
    const state = await client.getWorkspaceState();
    const rewrittenCommit = state.commits.find(
      (c) => c.description.trim() === 'remote commit',
    )!;
    expect(rewrittenCommit.bookmarks).toEqual([
      {
        name: 'myBookmark',
        remote: undefined,
        needsUpload: true,
        isConflicted: false,
      },
    ]);
  });

  it('fetches local and remote bookmark when they point to different commits', async () => {
    await remote.jj('describe', '-m', 'remote commit');
    await remote.jj('bookmark', 'set', 'myBookmark');

    await local.jj('git', 'fetch');
    await local.jj('bookmark', 'track', 'myBookmark');
    await local.jj('edit', 'myBookmark');
    const c1ChangeId = await local.getWcChangeId();
    await local.jj('new');
    const c2ChangeId = await local.getWcChangeId();
    await local.jj('bookmark', 'move', 'myBookmark', '--to', '@');

    const client = new SubprocessClient(local.repo.workspaceRoot);
    const state = await client.getWorkspaceState();

    const c1 = state.commits.find((c) => c.changeId.hex === c1ChangeId)!;
    const c2 = state.commits.find((c) => c.changeId.hex === c2ChangeId)!;
    expect(c1.bookmarks).toEqual([
      {
        name: 'myBookmark',
        remote: 'origin',
        needsUpload: false,
        isConflicted: false,
      },
    ]);
    expect(c2.bookmarks).toEqual([
      {
        name: 'myBookmark',
        remote: undefined,
        needsUpload: true,
        isConflicted: false,
      },
    ]);
  });
});
