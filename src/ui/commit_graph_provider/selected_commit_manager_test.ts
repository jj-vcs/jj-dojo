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
import {Commit} from '../../api/api';
import {SubprocessClient} from '../../client/subprocess_client';
import {installVscode} from '../../testing/install_vscode';
import {newRepo} from '../../testing/new_repo';
import {SelectedCommitManager} from './selected_commit_manager';

describe('SelectedCommitManager', () => {
  const {jj, repo, getWcChangeId} = newRepo();
  let client: SubprocessClient;
  let manager: SelectedCommitManager;
  let emitted: Array<Commit | undefined>;

  beforeEach(() => {
    installVscode();
    client = new SubprocessClient(repo.workspaceRoot);
    manager = new SelectedCommitManager();
    emitted = [];
    manager.onDidChange((commit) => {
      emitted.push(commit);
    });
  });

  afterEach(() => {
    manager.dispose();
  });

  async function getCommits(): Promise<readonly Commit[]> {
    const state = await client.getWorkspaceState();
    return state.commits;
  }

  function findByDescription(
    commits: readonly Commit[],
    descriptionTitle: string,
  ): Commit {
    const commit = commits.find((c) => c.descriptionTitle === descriptionTitle);
    if (!commit) {
      throw new Error(`Commit with title '${descriptionTitle}' not found`);
    }
    return commit;
  }

  it('selects a mutable non-parent commit and clears when set to undefined', async () => {
    await jj('describe', '-m', 'c1');
    await jj('new', '-m', 'c2');
    await jj('new', '-m', 'wc');

    const commits = await getCommits();
    const c1 = findByDescription(commits, 'c1');

    manager.updateCommits(commits);
    expect(emitted).toEqual([undefined]);

    manager.updateSelectedCommit(c1);
    expect(emitted).toEqual([undefined, c1]);

    manager.updateSelectedCommit(undefined);
    expect(emitted).toEqual([undefined, c1, undefined]);
  });

  it('resolves a commit selected before updateCommits once commits are provided', async () => {
    await jj('describe', '-m', 'c1');
    await jj('new', '-m', 'c2');
    await jj('new', '-m', 'wc');

    const commits = await getCommits();
    const c1 = findByDescription(commits, 'c1');

    manager.updateSelectedCommit(c1);
    expect(emitted).toEqual([undefined]);

    manager.updateCommits(commits);
    expect(emitted).toEqual([undefined, c1]);
  });

  it('clears selection when selecting the working copy commit, its only parent, or an immutable commit', async () => {
    await jj('describe', '-m', 'c1');
    await jj('new', '-m', 'c2');
    await jj('new', '-m', 'wc');

    const commits = await getCommits();
    const root = commits.find((c) => c.parentIds.length === 0)!;
    const c1 = findByDescription(commits, 'c1');
    const c2 = findByDescription(commits, 'c2');
    const wc = findByDescription(commits, 'wc');

    manager.updateCommits(commits);
    manager.updateSelectedCommit(c1);
    expect(emitted[emitted.length - 1]).toEqual(c1);

    // Selecting the working copy commit clears the selection.
    manager.updateSelectedCommit(wc);
    expect(emitted[emitted.length - 1]).toBeUndefined();

    // Selecting the working copy commit's only parent (c2) clears the selection.
    manager.updateSelectedCommit(c2);
    expect(emitted[emitted.length - 1]).toBeUndefined();

    // Selecting the immutable root commit clears the selection.
    manager.updateSelectedCommit(root);
    expect(emitted[emitted.length - 1]).toBeUndefined();

    // Marking c1 as immutable clears the selection when updated.
    manager.updateSelectedCommit(c1);
    expect(emitted[emitted.length - 1]).toEqual(c1);
    await jj(
      'config',
      'set',
      '--repo',
      'revset-aliases."immutable_heads()"',
      'subject(c1)',
    );
    manager.updateCommits(await getCommits());
    expect(emitted[emitted.length - 1]).toBeUndefined();
  });

  it('allows selecting a parent of the working copy when the working copy is a merge commit', async () => {
    await jj('describe', '-m', 'side1');
    const side1ChangeId = await getWcChangeId();

    await jj('new', 'root()', '-m', 'side2');
    const side2ChangeId = await getWcChangeId();

    await jj('new', side1ChangeId, side2ChangeId, '-m', 'merge wc');

    const commits = await getCommits();
    const side1 = findByDescription(commits, 'side1');
    const side2 = findByDescription(commits, 'side2');

    manager.updateCommits(commits);
    manager.updateSelectedCommit(side1);
    expect(emitted[emitted.length - 1]).toEqual(side1);

    manager.updateSelectedCommit(side2);
    expect(emitted[emitted.length - 1]).toEqual(side2);
  });

  it('evolves the selected commit when it is rewritten', async () => {
    await jj('describe', '-m', 'c1');
    await jj('new', '-m', 'c2');
    await jj('new', '-m', 'wc');

    const initialCommits = await getCommits();
    const initialC1 = findByDescription(initialCommits, 'c1');

    manager.updateCommits(initialCommits);
    manager.updateSelectedCommit(initialC1);
    expect(emitted[emitted.length - 1]).toEqual(initialC1);

    await jj('describe', '-r', initialC1.changeId.hex, '-m', 'c1 rewritten');
    const updatedCommits = await getCommits();
    const rewrittenC1 = findByDescription(updatedCommits, 'c1 rewritten');
    expect(rewrittenC1.id.hex).not.toEqual(initialC1.id.hex);
    expect(rewrittenC1.changeId.hex).toEqual(initialC1.changeId.hex);

    manager.updateCommits(updatedCommits);
    expect(emitted[emitted.length - 1]).toEqual(rewrittenC1);
  });

  it('clears selection when the working copy moves so the selected commit becomes the working copy or its only parent', async () => {
    await jj('describe', '-m', 'c1');
    await jj('new', '-m', 'c2');
    await jj('new', '-m', 'wc');

    const initialCommits = await getCommits();
    const c1 = findByDescription(initialCommits, 'c1');

    manager.updateCommits(initialCommits);
    manager.updateSelectedCommit(c1);
    expect(emitted[emitted.length - 1]).toEqual(c1);

    // Move working copy on top of c1 so c1 becomes the working copy's only parent.
    await jj('new', c1.changeId.hex);
    manager.updateCommits(await getCommits());
    expect(emitted[emitted.length - 1]).toBeUndefined();

    // Now c2 is on a sibling branch and can be selected.
    const commitsAfterNew = await getCommits();
    const currentC2 = findByDescription(commitsAfterNew, 'c2');
    manager.updateSelectedCommit(currentC2);
    expect(emitted[emitted.length - 1]).toEqual(currentC2);

    // Editing c2 makes it the active working copy commit, clearing the selection.
    await jj('edit', currentC2.changeId.hex);
    manager.updateCommits(await getCommits());
    expect(emitted[emitted.length - 1]).toBeUndefined();
  });

  it('clears selection when the selected commit is abandoned', async () => {
    await jj('describe', '-m', 'c1');
    await jj('new', '-m', 'c2');
    await jj('new', '-m', 'wc');

    const initialCommits = await getCommits();
    const c1 = findByDescription(initialCommits, 'c1');

    manager.updateCommits(initialCommits);
    manager.updateSelectedCommit(c1);
    expect(emitted[emitted.length - 1]).toEqual(c1);

    await jj('abandon', c1.changeId.hex);
    manager.updateCommits(await getCommits());
    expect(emitted[emitted.length - 1]).toBeUndefined();
  });

  it('clears selection when the selected commit diverges', async () => {
    await jj('describe', '-m', 'c1');
    await jj('new', '-m', 'c2');
    await jj('new', '-m', 'wc');

    const initialCommits = await getCommits();
    const c1 = findByDescription(initialCommits, 'c1');

    manager.updateCommits(initialCommits);
    manager.updateSelectedCommit(c1);
    expect(emitted[emitted.length - 1]).toEqual(c1);

    // Rewrite c1 at two concurrent operations to make it diverge.
    await jj('describe', '-r', c1.changeId.hex, '-m', 'c1 divergent 1');
    await jj(
      'describe',
      '-r',
      c1.changeId.hex,
      '-m',
      'c1 divergent 2',
      '--at-op=@-',
    );

    manager.updateCommits(await getCommits());
    expect(emitted[emitted.length - 1]).toBeUndefined();
  });

  it('stops emitting events after dispose', async () => {
    await jj('describe', '-m', 'c1');
    await jj('new', '-m', 'c2');
    await jj('new', '-m', 'wc');

    const commits = await getCommits();
    const c1 = findByDescription(commits, 'c1');

    manager.dispose();
    manager.updateCommits(commits);
    manager.updateSelectedCommit(c1);
    expect(emitted).toEqual([]);
  });
});
