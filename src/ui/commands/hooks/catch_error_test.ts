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
import {fakeVscode, installVscode} from '../../../testing/install_vscode';
import {VscodeCommandCallback} from '../types';
import {catchError} from './catch_error';

function registerCommand(command: string, cb: VscodeCommandCallback) {
  vscode.commands.registerCommand(command, catchError(cb));
}

describe('catchError', () => {
  beforeEach(installVscode);

  it('returns the result of the command when it succeeds', async () => {
    const testCommand = jasmine.createSpy().and.resolveTo('success');

    registerCommand('jj.testCommand', testCommand);

    const result = await fakeVscode().commands.executeCommand(
      'jj.testCommand',
      'arg1',
      'arg2',
    );

    expect(testCommand).toHaveBeenCalledOnceWith('arg1', 'arg2');
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
    expect(result).toBe('success');
  });

  it('catches errors thrown by the command and shows a user error message', async () => {
    const testCommand = jasmine
      .createSpy()
      .and.rejectWith(new Error('command failed'));

    registerCommand('jj.testCommand', testCommand);

    const result = await fakeVscode().commands.executeCommand(
      'jj.testCommand',
      'arg1',
    );

    expect(testCommand).toHaveBeenCalledOnceWith('arg1');
    expect(fakeVscode().window.showErrorMessage).toHaveBeenCalledOnceWith(
      'command failed',
      {},
    );
    expect(result).toBeUndefined();
  });
});
