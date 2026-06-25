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
import {Conflict} from './parser';
import {getResolvedText, getResolvedTextForAllSides} from './resolver';

/**
 * Callback for 'Accept all sides' command.
 *
 * @param args The arguments passed to the VSCode command.
 */
export function acceptAllSides(args: unknown[]) {
  if (args.length === 0) {
    throw new Error('Missing args for jjMergeConflict.acceptAllSides');
  }
  const conflict = args[0] as Conflict;
  const editor = getActiveTextEditor();
  const resolvedText = getResolvedTextForAllSides(
    conflict.sides.map(side => editor.document.getText(side.range)),
  );
  editor.edit((edit: vscode.TextEditorEdit) => {
    edit.replace(getRangeToReplace(conflict, resolvedText), resolvedText);
  });
}

/**
 * Callback for 'Accept side #X' command.
 *
 * @param args The arguments passed to the VSCode command.
 */
export function acceptOneSide(args: unknown[]) {
  if (args.length !== 2) {
    throw new Error('Missing args for jjMergeConflict.acceptOneSide');
  }
  const conflict = args[0] as Conflict;
  const side = args[1] as number;
  const editor = getActiveTextEditor();
  const unresolvedText = editor.document.getText(conflict.sides[side].range);
  const resolvedText = getResolvedText(unresolvedText);
  editor.edit((edit: vscode.TextEditorEdit) => {
    edit.replace(getRangeToReplace(conflict, resolvedText), resolvedText);
  });
}

/**
 * Returns the active text editor or throws an error if there is none.
 */
export function getActiveTextEditor(): vscode.TextEditor {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    // It should be impossible to reach here. When user clicks 'Accept all sides'
    // or 'Accept side #X' codelens, there must be an active text editor.
    throw new Error('jjMergeConflict: No active text editor');
  }
  return editor;
}

/**
 * Returns the range to replace in the active text editor.
 *
 * @resolvedText The text that should be shown after resolving the conflict.
 */
function getRangeToReplace(conflict: Conflict, resolvedText: string) {
  const start = conflict.beginLine.start;
  const end =
    resolvedText.length === 0
      ? new vscode.Position(conflict.endLine.end.line + 1, 0)
      : conflict.endLine.end;
  return new vscode.Range(start, end);
}
