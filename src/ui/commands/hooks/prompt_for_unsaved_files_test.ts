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
import * as vscode from 'vscode';
import {FakeTextDocument} from '../../../testing/fakes';
import {fakeVscode, installVscode} from '../../../testing/install_vscode';
import {VscodeCommandCallback} from '../types';
import {maybePromptForUnsavedFiles} from './prompt_for_unsaved_files';

function registerCommand(
  command: string,
  cb: VscodeCommandCallback,
  operationDescription: string,
) {
  vscode.commands.registerCommand(
    command,
    maybePromptForUnsavedFiles(cb, operationDescription),
  );
}

describe('maybePromptForUnsavedFiles', () => {
  beforeEach(installVscode);

  it('runs the command without prompting when there are no open documents', async () => {
    const testCommand = jasmine.createSpy();
    registerCommand('jj.testCommand', testCommand, 'Test Command');
    await fakeVscode().commands.executeCommand(
      'jj.testCommand',
      'arg1',
      'arg2',
    );
    expect(fakeVscode().window.showInformationMessage).not.toHaveBeenCalled();
    expect(fakeVscode().window.showWarningMessage).not.toHaveBeenCalled();
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
    expect(testCommand).toHaveBeenCalledOnceWith('arg1', 'arg2');
  });

  it('runs the command without prompting when only clean or untitled dirty documents are open', async () => {
    const cleanDoc = new FakeTextDocument({
      uri: vscode.Uri.file('/workspace/src/clean.ts'),
      isDirty: false,
    });
    const untitledDirtyDoc = new FakeTextDocument({
      isDirty: true,
    });
    fakeVscode().workspace.textDocuments = [cleanDoc, untitledDirtyDoc];
    const testCommand = jasmine.createSpy();
    registerCommand('jj.testCommand', testCommand, 'Test Command');
    await fakeVscode().commands.executeCommand(
      'jj.testCommand',
      'arg1',
      'arg2',
    );
    expect(fakeVscode().window.showInformationMessage).not.toHaveBeenCalled();
    expect(fakeVscode().window.showWarningMessage).not.toHaveBeenCalled();
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
    expect(untitledDirtyDoc.isDirty).toBeTrue();
    expect(testCommand).toHaveBeenCalledOnceWith('arg1', 'arg2');
  });

  it('prompts with the file basename for a single unsaved file and saves before running the command', async () => {
    const dirtyDoc = new FakeTextDocument({
      uri: vscode.Uri.file('/workspace/src/dirty.ts'),
      isDirty: true,
    });
    const cleanDoc = new FakeTextDocument({
      uri: vscode.Uri.file('/workspace/src/clean.ts'),
      isDirty: false,
    });
    const untitledDirtyDoc = new FakeTextDocument({
      isDirty: true,
    });
    fakeVscode().workspace.textDocuments = [
      dirtyDoc,
      cleanDoc,
      untitledDirtyDoc,
    ];
    fakeVscode().window.showWarningMessage.and.resolveTo(
      'Save All & Test Command',
    );

    let isDirtyDuringCommand: boolean | undefined;
    const testCommand = jasmine.createSpy().and.callFake(() => {
      isDirtyDuringCommand = dirtyDoc.isDirty;
      return 'done';
    });

    registerCommand('jj.testCommand', testCommand, 'Test Command');

    const result = await fakeVscode().commands.executeCommand(
      'jj.testCommand',
      'arg1',
      'arg2',
    );

    expect(fakeVscode().window.showInformationMessage).not.toHaveBeenCalled();
    expect(fakeVscode().window.showWarningMessage).toHaveBeenCalledOnceWith(
      `The following file has unsaved changes which won't be included in the test command if you proceed: dirty.ts.

Would you like to save it before the test command?`,
      {modal: true},
      'Save All & Test Command',
      'Test Command anyway',
    );
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
    expect(isDirtyDuringCommand).toBeFalse();
    expect(dirtyDoc.isDirty).toBeFalse();
    expect(untitledDirtyDoc.isDirty).toBeTrue();
    expect(testCommand).toHaveBeenCalledOnceWith('arg1', 'arg2');
    expect(result).toBe('done');
  });

  it('prompts with the file count for multiple unsaved files and saves all before running the command', async () => {
    const dirtyDoc1 = new FakeTextDocument({
      uri: vscode.Uri.file('/workspace/src/first.ts'),
      isDirty: true,
    });
    const dirtyDoc2 = new FakeTextDocument({
      uri: vscode.Uri.file('/workspace/src/second.ts'),
      isDirty: true,
    });
    const untitledDirtyDoc = new FakeTextDocument({
      isDirty: true,
    });
    fakeVscode().workspace.textDocuments = [
      dirtyDoc1,
      dirtyDoc2,
      untitledDirtyDoc,
    ];
    fakeVscode().window.showWarningMessage.and.resolveTo(
      'Save All & Test Command',
    );

    let dirtyStatesDuringCommand: boolean[] = [];
    const testCommand = jasmine.createSpy().and.callFake(() => {
      dirtyStatesDuringCommand = [dirtyDoc1.isDirty, dirtyDoc2.isDirty];
    });

    registerCommand('jj.testCommand', testCommand, 'Test Command');

    await fakeVscode().commands.executeCommand(
      'jj.testCommand',
      'arg1',
      'arg2',
    );

    expect(fakeVscode().window.showInformationMessage).not.toHaveBeenCalled();
    expect(fakeVscode().window.showWarningMessage).toHaveBeenCalledOnceWith(
      `There are 2 unsaved files.

Would you like to save them before the test command?`,
      {modal: true},
      'Save All & Test Command',
      'Test Command anyway',
    );
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
    expect(dirtyStatesDuringCommand).toEqual([false, false]);
    expect(dirtyDoc1.isDirty).toBeFalse();
    expect(dirtyDoc2.isDirty).toBeFalse();
    expect(untitledDirtyDoc.isDirty).toBeTrue();
    expect(testCommand).toHaveBeenCalledOnceWith('arg1', 'arg2');
  });

  it('runs the command without saving when the user chooses to proceed anyway', async () => {
    const dirtyDoc = new FakeTextDocument({
      uri: vscode.Uri.file('/workspace/src/dirty.ts'),
      isDirty: true,
    });
    fakeVscode().workspace.textDocuments = [dirtyDoc];
    fakeVscode().window.showWarningMessage.and.resolveTo('Test Command anyway');

    let isDirtyDuringCommand: boolean | undefined;
    const testCommand = jasmine.createSpy().and.callFake(() => {
      isDirtyDuringCommand = dirtyDoc.isDirty;
    });

    registerCommand('jj.testCommand', testCommand, 'Test Command');

    await fakeVscode().commands.executeCommand(
      'jj.testCommand',
      'arg1',
      'arg2',
    );

    expect(fakeVscode().window.showInformationMessage).not.toHaveBeenCalled();
    expect(fakeVscode().window.showWarningMessage).toHaveBeenCalledOnceWith(
      `The following file has unsaved changes which won't be included in the test command if you proceed: dirty.ts.

Would you like to save it before the test command?`,
      {modal: true},
      'Save All & Test Command',
      'Test Command anyway',
    );
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
    expect(isDirtyDuringCommand).toBeTrue();
    expect(dirtyDoc.isDirty).toBeTrue();
    expect(testCommand).toHaveBeenCalledOnceWith('arg1', 'arg2');
  });

  it('does not save or run the command when the user cancels the prompt', async () => {
    const dirtyDoc = new FakeTextDocument({
      uri: vscode.Uri.file('/workspace/src/dirty.ts'),
      isDirty: true,
    });
    fakeVscode().workspace.textDocuments = [dirtyDoc];
    fakeVscode().window.showWarningMessage.and.resolveTo(undefined);

    const testCommand = jasmine.createSpy();
    registerCommand('jj.testCommand', testCommand, 'Test Command');

    const result = await fakeVscode().commands.executeCommand(
      'jj.testCommand',
      'arg1',
      'arg2',
    );

    expect(fakeVscode().window.showInformationMessage).not.toHaveBeenCalled();
    expect(fakeVscode().window.showWarningMessage).toHaveBeenCalledOnceWith(
      `The following file has unsaved changes which won't be included in the test command if you proceed: dirty.ts.

Would you like to save it before the test command?`,
      {modal: true},
      'Save All & Test Command',
      'Test Command anyway',
    );
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
    expect(dirtyDoc.isDirty).toBeTrue();
    expect(testCommand).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  for (const autoSaveMode of [
    'afterDelay',
    'onFocusChange',
    'onWindowChange',
  ] as const) {
    it(`automatically saves unsaved files without prompting when files.autoSave is '${autoSaveMode}'`, async () => {
      await fakeVscode()
        .workspace.getConfiguration('files')
        .update('autoSave', autoSaveMode);

      const dirtyDoc = new FakeTextDocument({
        uri: vscode.Uri.file('/workspace/src/dirty.ts'),
        isDirty: true,
      });
      fakeVscode().workspace.textDocuments = [dirtyDoc];

      let isDirtyDuringCommand: boolean | undefined;
      const testCommand = jasmine.createSpy().and.callFake(() => {
        isDirtyDuringCommand = dirtyDoc.isDirty;
      });

      registerCommand('jj.testCommand', testCommand, 'Test Command');

      await fakeVscode().commands.executeCommand(
        'jj.testCommand',
        'arg1',
        'arg2',
      );

      expect(fakeVscode().window.showInformationMessage).not.toHaveBeenCalled();
      expect(fakeVscode().window.showWarningMessage).not.toHaveBeenCalled();
      expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
      expect(isDirtyDuringCommand).toBeFalse();
      expect(dirtyDoc.isDirty).toBeFalse();
      expect(testCommand).toHaveBeenCalledOnceWith('arg1', 'arg2');
    });
  }
});
