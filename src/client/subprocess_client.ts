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

import {
  ChangeId,
  Commit,
  CommitId,
  MutableCommit,
  OperationId,
  RepoState,
} from '../api/api';
import {Client} from '../client/client';
import {
  calculateAncestors,
  calculateDescendants,
  getCommitIdToCommitMap,
} from '../utils/commit_topology';
import {HashMap} from '../utils/hashmap';
import {HashSet} from '../utils/hashset';
import {subprocess} from './subprocess_util';

export class SubprocessClient implements Client {
  constructor(private readonly workspaceRoot: string) {}

  async getWorkspaceState(): Promise<RepoState> {
    const opHead = await snapshotWithoutIntegrating(this.workspaceRoot);
    const commits = await getCommits(this.workspaceRoot, opHead);
    return {
      commits,
    };
  }
}

interface RawBookmark {
  name: string;
  remote: string | null;
  synced: boolean;
  conflict: boolean;
}

interface RawCommit {
  id: string;
  changeId: string;
  description: string;
  parents: string[];
  active: boolean;
  createdTime: string;
  updateTime: string;
  hasConflict: boolean;
  hasDiverged: boolean;
  shortestChangeId: string;
  bookmarks: RawBookmark[];
  changeOffset: number;
}

/**
 * Builds a `jj` template expression that formats a set of fields as a JSON
 * object.
 *
 * Example input:
 * ```ts
 * {
 *   id: 'json(commit_id)',
 *   active: 'json(current_working_copy)',
 * }
 * ```
 *
 * Example output:
 * ```
 * "{" ++ json("id") ++ ":" ++ json(commit_id) ++ "," ++ json("active") ++ ":" ++ json(current_working_copy) ++ "}"
 * ```
 */
function toJsonObjectTemplate<T>(fields: Record<keyof T, string>): string {
  return (
    '"{" ++ ' +
    Object.entries(fields)
      .map(([key, expr]) => `json("${key}") ++ ":" ++ ${expr}`)
      .join(' ++ "," ++ ') +
    ' ++ "}"'
  );
}

async function snapshotWithoutIntegrating(
  workspaceRoot: string,
): Promise<OperationId> {
  const {stdout} = await subprocess({
    cwd: workspaceRoot,
    command: 'jj',
    args: [
      '--color=never',
      '--no-integrate-operation',
      'op',
      'log',
      '-n=1',
      // TODO: --no-graph drops jj's elided edges. Our commit graph also
      // don't support rendering elided edges. This will need to be fixed.
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
  const bookmarkTemplateFields: Record<keyof RawBookmark, string> = {
    name: 'json(b.name())',
    remote: 'json(b.remote())',
    synced: 'json(b.synced())',
    conflict: 'json(b.conflict())',
  };
  const templateFields: Record<keyof RawCommit, string> = {
    id: 'json(commit_id)',
    changeId: 'json(change_id)',
    description: 'json(description)',
    parents: 'json(parents.map(|c| c.commit_id()))',
    active: 'json(current_working_copy)',
    createdTime: 'json(author.timestamp().format("%s"))',
    updateTime: 'json(committer.timestamp().format("%s"))',
    hasConflict: 'json(conflict)',
    hasDiverged: 'json(divergent)',
    shortestChangeId: 'json(change_id.shortest().prefix())',
    bookmarks: `"[" ++ bookmarks.map(|b| ${toJsonObjectTemplate(bookmarkTemplateFields)}).join(",") ++ "]"`,
    changeOffset: 'json(change_offset)',
  };
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
      `${toJsonObjectTemplate(templateFields)} ++ "\\n"`,
    ],
  });

  const rawCommits: RawCommit[] = [];
  for (const line of stdout.split('\n')) {
    if (!line.trim()) {
      continue;
    }
    rawCommits.push(JSON.parse(line));
  }

  // Show at least the first 4 characters of the change id in the
  // commit graph. If there is a commit that needs more than that
  // to uniquely identify it, force the rest of commits to display
  // change ids that are as long as that.
  let displayIdLength = 4;
  for (const commit of rawCommits) {
    displayIdLength = Math.max(displayIdLength, commit.shortestChangeId.length);
  }

  const childrenMap = new HashMap<CommitId, CommitId[]>();
  for (const commit of rawCommits) {
    childrenMap.set(new CommitId(commit.id), []);
  }
  for (const commit of rawCommits) {
    for (const parentId of commit.parents) {
      childrenMap.get(new CommitId(parentId))?.push(new CommitId(commit.id));
    }
  }
  const wcParentCommitIds = new Set<string>();
  for (const commit of rawCommits) {
    if (commit.active) {
      for (const parentId of commit.parents) {
        wcParentCommitIds.add(parentId);
      }
    }
  }

  const commits = rawCommits.map((rawCommit) =>
    rawCommitToApiCommit(
      childrenMap,
      wcParentCommitIds,
      displayIdLength,
      rawCommit,
    ),
  );

  const commitMap = getCommitIdToCommitMap(commits);
  calculateAncestors(commitMap);
  calculateDescendants(commitMap);
  return commits;
}

function rawCommitToApiCommit(
  childrenMap: HashMap<CommitId, CommitId[]>,
  wcParentCommitIds: Set<string>,
  displayIdLength: number,
  raw: RawCommit,
): MutableCommit {
  const commitId = new CommitId(raw.id);
  const displayedChangeId = raw.changeId.substring(0, displayIdLength);
  const displayId = raw.hasDiverged
    ? `${displayedChangeId}/${raw.changeOffset}`
    : displayedChangeId;

  return {
    id: commitId,
    changeId: new ChangeId(raw.changeId),
    parentIds: raw.parents.map((p) => new CommitId(p)),
    childIds: childrenMap.get(commitId) ?? [],
    active: raw.active,
    isWorkingCopyParentCommit: wcParentCommitIds.has(raw.id),
    description: raw.description,
    descriptionTitle: raw.description.split(/\r?\n/)[0],
    updateTime: parseInt(raw.updateTime, 10) * 1000,
    createdTime: parseInt(raw.createdTime, 10) * 1000,
    hasConflict: raw.hasConflict,
    hasDiverged: raw.hasDiverged,
    displayId: displayId,
    highlightedDisplayIdLen: raw.shortestChangeId.length,
    bookmarks: raw.bookmarks.map((b) => ({
      name: b.name,
      remote: b.remote ?? undefined,
      needsUpload: !b.remote && !b.synced && !b.conflict,
      isConflicted: b.conflict,
    })),
    changeOffset: raw.hasDiverged ? raw.changeOffset : undefined,
    ancestors: new HashSet<CommitId>(),
    descendants: new HashSet<CommitId>(),
  };
}
