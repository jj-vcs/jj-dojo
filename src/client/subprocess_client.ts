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

import {RepoState, Commit, CommitId, ChangeId, OperationId} from '../api/api';
import {Client} from '../client/client';
import {subprocess} from './subprocess_util';
import {HashMap} from '../utils/hashmap';

export class SubprocessClient implements Client {
  constructor(private readonly workspaceRoot: string) {}

  async getWorkspaceState(): Promise<RepoState> {
    const opHead = await unpublishSnapshot(this.workspaceRoot);
    const commits = await getCommits(this.workspaceRoot, opHead);
    return {
      commits,
    };
  }

  static async GitInit(workspaceRoot: string): Promise<SubprocessClient> {
    await subprocess({
      cwd: workspaceRoot,
      command: 'jj',
      args: ['git', 'init'],
    });
    return new SubprocessClient(workspaceRoot);
  }
}

interface RawCommit {
  id: CommitId;
  changeId: ChangeId;
  description: string;
  parents: CommitId[];
  active: boolean;
  createdTime: number;
  updateTime: number;
  hasConflict: boolean;
  hasDiverged: boolean;
  shortestChangeId: string;
  changeOffset: number | undefined;
}

async function unpublishSnapshot(workspaceRoot: string): Promise<OperationId> {
  const {stdout} = await subprocess({
    cwd: workspaceRoot,
    command: 'jj',
    args: [
      '--color=never',
      '--no-integrate-operation',
      'op',
      'log',
      '-n=1',
      '--no-graph',
      '-T=id',
    ],
  });
  return new OperationId(stdout.trim());
}

async function getCommits(
  workspaceRoot: string,
  op: OperationId,
): Promise<Commit[]> {
  const fieldDelimiter = '~<jj-vscode-field-delimiter>~';
  const commitDelimiter = '~<jj-vscode-commit-delimiter>~';
  const templateFields = [
    'commit_id',
    'change_id',
    'description',
    'parents.map(|c| c.commit_id()).join(" ")',
    'current_working_copy',
    'author.timestamp().format("%s")',
    'committer.timestamp().format("%s")',
    'conflict',
    'divergent',
    'change_id.shortest()',
    'change_offset',
  ];
  const {stdout} = await subprocess({
    cwd: workspaceRoot,
    command: 'jj',
    args: [
      '--at-op',
      op.hex,
      '--color=never',
      'log',
      '--no-graph',
      '-T',
      templateFields.join(` ++ "${fieldDelimiter}" ++ `) +
        ` ++ "${commitDelimiter}" `,
    ],
  });

  const rawCommits: RawCommit[] = [];
  for (const serializedCommit of stdout.split(commitDelimiter)) {
    if (!serializedCommit.trim()) {
      continue;
    }
    const fields = serializedCommit.split(fieldDelimiter);
    const id = new CommitId(fields[0]);
    const changeId = new ChangeId(fields[1]);
    const description = fields[2];
    const parents = fields[3]
      .split(' ')
      .filter(Boolean)
      .map((p) => new CommitId(p));
    const active = fields[4] === 'true';
    const createdTime = parseInt(fields[5], 10) * 1000;
    const updateTime = parseInt(fields[6], 10) * 1000;
    const hasConflict = fields[7] === 'true';
    const hasDiverged = fields[8] === 'true';
    const shortestChangeId = fields[9];
    const changeOffset = hasDiverged ? parseInt(fields[10], 10) : undefined;

    rawCommits.push({
      id,
      changeId,
      description,
      parents,
      active,
      createdTime,
      updateTime,
      hasConflict,
      hasDiverged,
      shortestChangeId,
      changeOffset,
    });
  }

  // Show at least the first 4 characters of the change id in the
  // commit graph. If there is a commit that needs more than that
  // to uniquely identify it, force the rest of commits to display
  // change ids that are as long as that.
  let displayIdMinLength = 4;
  for (const commit of rawCommits) {
    displayIdMinLength = Math.max(
      displayIdMinLength,
      commit.shortestChangeId.length,
    );
  }

  const childrenMap = new HashMap<CommitId, CommitId[]>();
  for (const commit of rawCommits) {
    childrenMap.set(commit.id, []);
  }
  for (const commit of rawCommits) {
    for (const parentId of commit.parents) {
      childrenMap.get(parentId)?.push(commit.id);
    }
  }
  return rawCommits.map((rawCommit) =>
    rawCommitToApiCommit(childrenMap, displayIdMinLength, rawCommit),
  );
}

function rawCommitToApiCommit(
  childrenMap: HashMap<CommitId, CommitId[]>,
  displayIdMinLength: number,
  raw: RawCommit,
): Commit {
  const displayedChangeId = raw.changeId.hex.substring(
    0,
    Math.max(displayIdMinLength, raw.shortestChangeId.length),
  );
  const displayId = raw.hasDiverged
    ? `${displayedChangeId}/${raw.changeOffset}`
    : displayedChangeId;

  return {
    id: raw.id,
    changeId: raw.changeId,
    parents: raw.parents,
    children: childrenMap.get(raw.id) ?? [],
    active: raw.active,
    description: raw.description,
    updateTime: raw.updateTime,
    createdTime: raw.createdTime,
    hasConflict: raw.hasConflict,
    hasDiverged: raw.hasDiverged,
    displayId: displayId,
    highlightedDisplayIdLen: raw.shortestChangeId.length,
    changeOffset: raw.changeOffset,
  };
}
