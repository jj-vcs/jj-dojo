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

import * as path from 'path';
import {
  ChangeId,
  Commit,
  CommitFile,
  CommitId,
  FileId,
  FileMetadata,
  ModificationType,
  MutableCommit,
  OperationId,
  RepoState,
  WorkingCopy,
} from '../api/api';
import {Client} from '../client/client';
import {
  calculateAncestors,
  calculateDescendants,
  getCommitIdToCommitMap,
} from '../utils/commit_topology';
import {HashMap} from '../utils/hashmap';
import {HashSet} from '../utils/hashset';
import {Merge} from '../utils/merge';
import {subprocess, subprocessBuffer} from './subprocess_util';
import {logAndShowInternalError} from '../logging/logging';

export class SubprocessClient implements Client {
  constructor(private readonly workspaceRoot: string) {}

  async getWorkspaceState(): Promise<RepoState> {
    const opHead = await snapshotWithoutIntegrating(this.workspaceRoot);
    const {commits, conflictedFiles} = await getCommits(
      this.workspaceRoot,
      opHead,
    );
    return {
      opHead,
      commits,
      conflictedFiles,
    };
  }

  async readFileAtCommit(
    source: CommitId,
    opId: OperationId | undefined,
    workspacePath: string,
    options: {showParent: boolean},
  ): Promise<Uint8Array | undefined> {
    return fileShow({
      opId,
      commitId: source,
      workspaceRoot: this.workspaceRoot,
      workspacePath,
      showParent: options.showParent,
    });
  }

  async readFileById(
    source: FileId,
    workspacePath: string,
  ): Promise<Uint8Array> {
    const {stdout} = await subprocessBuffer({
      cwd: this.workspaceRoot,
      command: 'jj',
      // Without a stable api like https://github.com/jj-vcs/jj/issues/3219,
      // `jj debug` is currently the best way to get file contents for a file id.
      //
      // A few alternatives:
      //  - develop a `jj file show --id=<id>` command, which was rejected in
      //    https://github.com/jj-vcs/jj/pull/10458
      //  - use `git cat-file blob <id>`, but that only works for the git backend.
      args: [
        '--color=never',
        'debug',
        'object',
        'file',
        '--',
        workspacePath,
        source.hex,
      ],
    });
    return stdout;
  }

  async workspaceAdd(newWorkspaceRoot: string): Promise<WorkingCopy> {
    const jjWorkspaceId = path.basename(
      path.resolve(this.workspaceRoot, newWorkspaceRoot),
    );
    await subprocess({
      cwd: this.workspaceRoot,
      command: 'jj',
      // This function needs to return information about the created workspace,
      // but `jj workspace add` does not return machine parsable information
      // about the newly created workspace. To workaround that, calculate
      // and assign the workspace name ourselves.
      // TODO: it might be a good idea to not do this, but we need to come up
      // with a reliable way to find out which workspace was the one we created.
      args: [
        'workspace',
        'add',
        `--name=${jjWorkspaceId}`,
        // jj (via Rust's clap parser) treats any argument starting with - as a CLI flag
        // rather than a positional value unless -- (the standard POSIX end-of-options delimiter)
        // appears before positional arguments.
        '--',
        newWorkspaceRoot,
      ],
    });

    const workspaces = await this.workspaceList();
    const addedWorkspace = workspaces.find(
      (w) => w.jjWorkspaceId === jjWorkspaceId,
    );
    if (!addedWorkspace) {
      throw logAndShowInternalError(
        `Failed to find newly added workspace '${jjWorkspaceId}'`,
      );
    }
    return addedWorkspace;
  }

  private async workspaceList(): Promise<WorkingCopy[]> {
    const templateFields: Record<keyof RawWorkingCopy, string> = {
      name: 'json(self.name())',
      root: 'json(self.root())',
      currentWorkspace: 'json(self.current_workspace())',
    };
    const {stdout} = await subprocess({
      cwd: this.workspaceRoot,
      command: 'jj',
      args: [
        'workspace',
        'list',
        '--ignore-working-copy',
        '--color=never',
        '-T',
        `${toJsonObjectTemplate(templateFields)} ++ "\\n"`,
      ],
    });

    const workspaces: WorkingCopy[] = [];
    for (const line of stdout.split('\n')) {
      if (!line.trim()) {
        continue;
      }
      const raw: RawWorkingCopy = JSON.parse(line);
      workspaces.push(rawWorkingCopyToWorkingCopy(raw));
    }
    return workspaces;
  }
}

interface RawBookmark {
  name: string;
  remote: string | null;
  synced: boolean;
  conflict: boolean;
}

interface RawWorkingCopy {
  name: string;
  root: string | null;
  currentWorkspace: boolean;
}

interface RawFileMetadata {
  fileId: string;
}

interface RawCommitFile {
  path: string;
  status: string;
  sourcePath: string;
  conflict: boolean;
  addedValues: Array<RawFileMetadata | null>;
  removedValues: Array<RawFileMetadata | null>;
}

interface RawConflictedFile {
  path: string;
  addedValues: Array<RawFileMetadata | null>;
  removedValues: Array<RawFileMetadata | null>;
}

interface RawCommit {
  id: string;
  changeId: string;
  description: string;
  files: RawCommitFile[];
  conflictedFiles: RawConflictedFile[];
  parents: string[];
  active: boolean;
  createdTime: string;
  updateTime: string;
  hasConflict: boolean;
  hasDiverged: boolean;
  isImmutable: boolean;
  shortestChangeId: string;
  bookmarks: RawBookmark[];
  changeOffset: number;
  workingCopies: RawWorkingCopy[];
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
): Promise<{commits: Commit[]; conflictedFiles: CommitFile[]}> {
  const bookmarkTemplateFields: Record<keyof RawBookmark, string> = {
    name: 'json(b.name())',
    remote: 'json(b.remote())',
    synced: 'json(b.synced())',
    conflict: 'json(b.conflict())',
  };
  const workingCopyTemplateFields: Record<keyof RawWorkingCopy, string> = {
    name: 'json(w.name())',
    root: 'json(w.root())',
    currentWorkspace: 'json(w.current_workspace())',
  };
  const fileMetadataTemplateFields: Record<keyof RawFileMetadata, string> = {
    fileId: 'json(v.object_id())',
  };
  const fileMetadataTemplate = `if(v, ${toJsonObjectTemplate(fileMetadataTemplateFields)}, "null")`;
  const commitFileTemplateFields: Record<keyof RawCommitFile, string> = {
    path: 'json(f.path())',
    status: 'json(f.status())',
    sourcePath: 'json(f.source().path())',
    conflict: 'json(f.target().conflict())',
    addedValues: `"[" ++ f.target().added_values().map(|v| ${fileMetadataTemplate}).join(",") ++ "]"`,
    removedValues: `"[" ++ f.target().removed_values().map(|v| ${fileMetadataTemplate}).join(",") ++ "]"`,
  };
  const conflictedFileTemplateFields: Record<keyof RawConflictedFile, string> =
    {
      path: 'json(f.path())',
      addedValues: `"[" ++ f.added_values().map(|v| ${fileMetadataTemplate}).join(",") ++ "]"`,
      removedValues: `"[" ++ f.removed_values().map(|v| ${fileMetadataTemplate}).join(",") ++ "]"`,
    };
  const templateFields: Record<keyof RawCommit, string> = {
    id: 'json(commit_id)',
    changeId: 'json(change_id)',
    description: 'json(description)',
    files: `"[" ++ diff.files().map(|f| ${toJsonObjectTemplate(commitFileTemplateFields)}).join(",") ++ "]"`,
    conflictedFiles: `if(current_working_copy, "[" ++ conflicted_files.map(|f| ${toJsonObjectTemplate(conflictedFileTemplateFields)}).join(",") ++ "]", "[]")`,
    parents: 'json(parents.map(|c| c.commit_id()))',
    active: 'json(current_working_copy)',
    createdTime: 'json(author.timestamp().format("%s"))',
    updateTime: 'json(committer.timestamp().format("%s"))',
    hasConflict: 'json(conflict)',
    hasDiverged: 'json(divergent)',
    isImmutable: 'json(immutable)',
    shortestChangeId: 'json(change_id.shortest().prefix())',
    bookmarks: `"[" ++ bookmarks.map(|b| ${toJsonObjectTemplate(bookmarkTemplateFields)}).join(",") ++ "]"`,
    changeOffset: 'json(change_offset)',
    workingCopies: `"[" ++ working_copies.map(|w| ${toJsonObjectTemplate(workingCopyTemplateFields)}).join(",") ++ "]"`,
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

  // JJ does not set `working_copies` field when there is only one workspace.
  // Add the current workspace in that case to work around this behavior.
  const wcCommit = rawCommits.find((c) => c.active);
  if (wcCommit && wcCommit.workingCopies.length === 0) {
    const workingCopy: RawWorkingCopy = {
      // This is technically not correct. A user can rename the default workspace
      // to something else. We can choose to run `jj workspace list --ignore-working-copy`
      // to get the actual workspace name, but it might make the performance worse.
      name: 'default',
      root: workspaceRoot,
      currentWorkspace: true,
    };
    wcCommit.workingCopies = [workingCopy];
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
  const conflictedFiles = (wcCommit?.conflictedFiles ?? []).map(
    rawConflictedFileToCommitFile,
  );
  return {commits, conflictedFiles};
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
    files: raw.files.map(rawCommitFileToCommitFile),
    updateTime: parseInt(raw.updateTime, 10) * 1000,
    createdTime: parseInt(raw.createdTime, 10) * 1000,
    hasConflict: raw.hasConflict,
    hasDiverged: raw.hasDiverged,
    isImmutable: raw.isImmutable,
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
    workingCopies: raw.workingCopies.map(rawWorkingCopyToWorkingCopy),
  };
}

function rawWorkingCopyToWorkingCopy(raw: RawWorkingCopy): WorkingCopy {
  return {
    jjWorkspaceId: raw.name,
    workspaceRoot: raw.root ?? undefined,
    displayName: raw.name,
    currentWorkspace: raw.currentWorkspace,
  };
}

function rawCommitFileToCommitFile(raw: RawCommitFile): CommitFile {
  const adds = raw.addedValues.map(rawFileMetadataToFileMetadata);
  const removes = raw.removedValues.map(rawFileMetadataToFileMetadata);
  return {
    path: raw.path,
    modificationType: rawCommitFileToModificationType(raw),
    mergedFileMetadata: Merge.fromAddsAndRemoves(adds, removes),
    ...(raw.sourcePath !== raw.path ? {source: raw.sourcePath} : {}),
  };
}

function rawConflictedFileToCommitFile(raw: RawConflictedFile): CommitFile {
  const adds = raw.addedValues.map(rawFileMetadataToFileMetadata);
  const removes = raw.removedValues.map(rawFileMetadataToFileMetadata);
  return {
    path: raw.path,
    modificationType: ModificationType.CONFLICTED,
    mergedFileMetadata: Merge.fromAddsAndRemoves(adds, removes),
  };
}

function rawCommitFileToModificationType(raw: RawCommitFile): ModificationType {
  if (raw.conflict) {
    return ModificationType.CONFLICTED;
  }
  switch (raw.status) {
    case 'added':
      return ModificationType.ADDED;
    case 'modified':
      return ModificationType.MODIFIED;
    case 'removed':
      return ModificationType.DELETED;
    case 'renamed':
      return ModificationType.RENAMED;
    case 'copied':
      return ModificationType.COPIED;
    default:
      // Log without throwing so that if a new modification status is added in a
      // future jj version, the extension can still load the workspace state
      // instead of failing completely.
      logAndShowInternalError(`Unsupported modification status: ${raw.status}`);
      return ModificationType.UNKNOWN;
  }
}

function rawFileMetadataToFileMetadata(
  raw: RawFileMetadata | null,
): FileMetadata | undefined {
  if (raw === null) {
    return undefined;
  }
  return {
    fileId: new FileId(raw.fileId),
  };
}

async function fileShow(fields: {
  opId: OperationId | undefined;
  commitId: CommitId;
  workspaceRoot: string;
  workspacePath: string;
  showParent: boolean;
}): Promise<Uint8Array | undefined> {
  const {opId, commitId, workspaceRoot, workspacePath, showParent} = fields;
  try {
    const {stdout} = await subprocessBuffer({
      cwd: workspaceRoot,
      command: 'jj',
      args: [
        ...(opId ? [`--at-op=${opId.hex}`] : ['--ignore-working-copy']),
        '--color=never',
        'file',
        'show',
        // TODO: `-` does not work for merge commits. Once https://github.com/jj-vcs/jj/pull/10464
        // is merged and released, replace this with the `parents_of()` revset.
        `-r=${commitId.hex}` + (showParent ? '-' : ''),
        '--',
        // By default, `jj file show` parses paths as `prefix-glob:` fileset
        // patterns. Prefixing with `root:` (and quoting the path) matches the
        // workspace-relative path literally instead of as a glob expression.
        `root:"${workspacePath}"`,
      ],
    });
    return stdout;
  } catch (e: unknown) {
    // jj uses the same process exit code (1) for all runtime/user errors (CommandError::user),
    // and only uses exit code 2 for CLI argument/syntax errors. There's currently no better
    // way than error message string matching.
    if (e instanceof Error && e.message.includes('Error: No such path:')) {
      return undefined;
    }
    throw e;
  }
}
