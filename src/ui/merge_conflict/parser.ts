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

import * as vscode from 'vscode';

const SIDE_HEADER_REGEX = /\s+(\w+)\s+\w+(?:\s+".*")?(?:\s+\(.*\))*$/;

/**
 * An interface that represents a conflict in jj.
 *
 * A typical conflict in jj is formatted like the following:
 *
 * <<<<<<< conflict 1 of 1
 * %%%%%%% diff from: base_change_id base_commit_id "base commit message" (blah)
 * \\\\\\\        to: change_id_1 commit_id_1 (blah)
 *  apple
 * -grape
 * +grapefruit
 *  orange
 * +++++++ change_id_2 commit_id_2 "commit message 2" (blah)
 * APPLE
 * GRAPE
 * ORANGE
 * >>>>>>> conflict 1 of 1 ends
 */
export interface Conflict {
  // The range representing the starting line. e.g. "<<<<<<< conflict 1 of 1"
  beginLine: vscode.Range;
  // A list of all sides of this conflict.
  sides: ConflictSide[];
  // The range representing the ending line. e.g. ">>>>>>> conflict 1 of 1 ends"
  endLine: vscode.Range;
}

/**
 * A side of a conflict. e.g.
 *
 * +++++++ change_id commit_id "commit message" (side)
 * APPLE
 * GRAPE
 * ORANGE
 */
export interface ConflictSide {
  // Using the example above, its changeId is "change_id".
  changeId: string;
  // The range representing all lines of a side, including the header line.
  range: vscode.Range;
}

/**
 * Parses a text document for conflict markers and returns a list of
 * detected conflicts.
 *
 * TODO: - Add support for alternative conflict marker styles.
 * https://github.com/martinvonz/jj/blob/main/docs/conflicts.md#alternative-conflict-marker-styles
 */
export function parseTextDocument(document: vscode.TextDocument): Conflict[] {
  const conflicts: Conflict[] = [];

  let conflict: ConflictBuilder | undefined;
  for (let i = 0; i < document.lineCount; ++i) {
    const line = document.lineAt(i);
    const text = line.text;

    if (text.startsWith('<<<<<<< conflict ')) {
      conflict = new ConflictBuilder(line.range);
      continue;
    }
    if (!conflict) {
      continue;
    }

    const hasEnded = text.startsWith('>>>>>>> conflict ');
    const startsWithBackslashes = text.startsWith('\\\\\\\\\\\\\\');
    const previousLineText = document.lineAt(i - 1).text;
    if (
      (startsWithBackslashes && previousLineText.startsWith('%%%%%%%')) ||
      text.startsWith('+++++++') ||
      hasEnded
    ) {
      if (conflict.curSide) {
        const conflictSide = conflict.curSide.build(
          // If the line starts with backslashes, then the side header is on the
          // previous line.
          document.lineAt(i - 1 - +startsWithBackslashes).range.end,
        );
        conflict.sides.push(conflictSide);
        conflict.curSide = undefined;
      }
      if (!hasEnded) {
        const changeId = getChangeId(text);
        if (changeId !== undefined) {
          conflict.curSide = new ConflictSideBuilder(
            changeId,
            // If the line starts with backslashes, then the side header is on
            // the previous line.
            document.lineAt(i - +startsWithBackslashes).range.start,
          );
        }
      }
    }
    if (hasEnded) {
      if (conflict.sides.length > 0) {
        conflicts.push(conflict.build(line.range));
      }
      conflict = undefined;
    }
  }
  return conflicts;
}

class ConflictBuilder {
  readonly sides: ConflictSide[] = [];
  curSide?: ConflictSideBuilder;

  constructor(private readonly beginLine: vscode.Range) {}

  build(endLine: vscode.Range): Conflict {
    return {
      beginLine: this.beginLine,
      sides: this.sides,
      endLine,
    };
  }
}

/**
 * Each side of conflict usually spans multiple lines. The fields in this
 * class tracks the progress, and is used to build `ConflictSide` when
 * we see the end of a side.
 */
class ConflictSideBuilder {
  constructor(
    private readonly changeId: string,
    private readonly start: vscode.Position,
  ) {}

  build(end: vscode.Position): ConflictSide {
    return {
      changeId: this.changeId,
      range: new vscode.Range(this.start, end),
    };
  }
}

/**
 * Exposed for testing only.
 * Returns the change_id from a line of conflict header. If no change_id is
 * found, returns undefined.
 *
 * e.g. for `++++++ change_id commit_id "commit message" (blah)`, it returns "change_id".
 */
export function getChangeId(line: string): string | undefined {
  const matches = line.match(SIDE_HEADER_REGEX);
  return matches && matches.length === 2 ? matches[1] : undefined;
}
