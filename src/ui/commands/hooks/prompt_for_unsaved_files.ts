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
import {checkExhaustive} from '../../../utils/check';
import {VscodeCommandCallback} from '../types';
import {Utils} from 'vscode-uri';

/**
 * Prompts the user to save unsaved files if there are any before running the provided command.
 *
 * @param operationDescription: A human readable string to be displayed in the prompt describing
 * the operation that will be performed. e.g. Create Commit
 */
export function maybePromptForUnsavedFiles(
  cb: VscodeCommandCallback,
  operationDescription: string,
): VscodeCommandCallback {
  return async (...args) => {
    const unsavedDocuments = vscode.workspace.textDocuments.filter(
      (doc) => doc.isDirty && !doc.isUntitled,
    );
    const result =
      unsavedDocuments.length > 0
        ? await promptForUnsavedFiles(unsavedDocuments, operationDescription)
        : PromptResult.SKIP;
    switch (result) {
      case PromptResult.SAVE:
        // TODO: Check the boolean return value of save() and abort or handle
        // the error if any document fails to save.
        await Promise.all(unsavedDocuments.map((d) => d.save()));
        break;
      case PromptResult.SKIP:
        break;
      case PromptResult.CANCEL:
        // Return without running the command.
        return;
      default:
        checkExhaustive(result);
    }
    return cb(...args);
  };
}

/** The result of the prompt for unsaved files. */
enum PromptResult {
  SAVE,
  SKIP,
  CANCEL,
}

/**
 * Prompts the user to save unsaved files if there are any.
 *
 * @return The user's choice.
 */
async function promptForUnsavedFiles(
  unsavedDocuments: vscode.TextDocument[],
  operationDescription: string,
): Promise<PromptResult> {
  const config = vscode.workspace.getConfiguration('files');
  if (
    config.get<'onWindowChange' | 'onFocusChange' | 'afterDelay' | 'off'>(
      'autoSave',
    ) !== 'off'
  ) {
    return PromptResult.SAVE;
  }

  const lowerCasedOperation = operationDescription.toLowerCase();
  const dirtyItemsPrompt =
    unsavedDocuments.length === 1
      ? `The following file has unsaved changes which won't be included in the ${lowerCasedOperation} if you proceed: ${Utils.basename(unsavedDocuments[0].uri)}.

Would you like to save it before the ${lowerCasedOperation}?`
      : `There are ${unsavedDocuments.length} unsaved files.

Would you like to save them before the ${lowerCasedOperation}?`;
  const saveAndCommit = `Save All & ${operationDescription}`;
  const commitAnyway = `${operationDescription} anyway`;
  const selectedOption = await vscode.window.showWarningMessage(
    dirtyItemsPrompt,
    {modal: true},
    saveAndCommit,
    commitAnyway,
  );

  return selectedOption === saveAndCommit
    ? PromptResult.SAVE
    : selectedOption === commitAnyway
      ? PromptResult.SKIP
      : PromptResult.CANCEL;
}
