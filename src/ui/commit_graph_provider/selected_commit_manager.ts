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

import * as vscode from 'vscode';
import {Commit} from '../../api/api';
import {
  getEvolvedCommit,
  getWorkingCopyCommit,
} from '../../utils/commit_topology';

/**
 * A class that keeps track of the selected commit.
 *
 * This class exposes two methods - `updateSelectedCommit` and `updateCommits`.
 * Callers can call either method whenever they want to update the selected
 * commit or the commits list. On each update, the selected commit is evolved to
 * its latest version in `commits` and cleared if it no longer exists, has
 * diverged, is immutable, is the working copy commit, or is the working copy
 * commit's only parent. The resulting selection is emitted through
 * `onDidChange`.
 */
export class SelectedCommitManager<T extends Commit = Commit>
  implements vscode.Disposable
{
  private selected?: T;

  private commits?: readonly T[];

  private readonly onDidChangeEmitter = new vscode.EventEmitter<
    T | undefined
  >();

  /**
   * Fires with the resolved selected commit (or `undefined` if cleared) after
   * the selected commit or the commits list is updated.
   */
  readonly onDidChange: vscode.Event<T | undefined> =
    this.onDidChangeEmitter.event;

  /**
   * Updates the selected commit (or clears it when `undefined`), resolves it
   * against the current commits list, and emits the result via `onDidChange`.
   */
  updateSelectedCommit(commit?: T) {
    this.selected = commit;
    this.process();
  }

  /**
   * Updates the list of commits, evolves or clears the current selected commit
   * against the new list, and emits the result via `onDidChange`.
   */
  updateCommits(commits: readonly T[]) {
    this.commits = commits;
    this.process();
  }

  /** Disposes the internal event emitter and removes all registered listeners. */
  dispose() {
    this.onDidChangeEmitter.dispose();
  }

  /**
   * Resolves `selected` against `commits`, clears it if it is not selectable,
   * and fires `onDidChange`.
   */
  private process() {
    if (!this.selected || !this.commits) {
      this.onDidChangeEmitter.fire(undefined);
      return;
    }
    this.selected = getEvolvedCommit(this.commits, this.selected);
    if (
      !this.selected ||
      this.selected.active ||
      isWorkingCopyCommitsOnlyParent(this.commits, this.selected) ||
      this.selected.isImmutable
    ) {
      this.selected = undefined;
    }
    this.onDidChangeEmitter.fire(this.selected);
  }
}

/**
 * Returns true iff `commit` is the only parent of the working copy commit.
 */
function isWorkingCopyCommitsOnlyParent(
  commits: readonly Commit[],
  commit: Commit,
): boolean {
  const wcCommit = getWorkingCopyCommit(commits);
  return (
    wcCommit.parentIds.length === 1 &&
    wcCommit.parentIds[0].hex === commit.id.hex
  );
}
