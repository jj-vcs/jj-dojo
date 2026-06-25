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

import {FakeLogOutputChannel} from './fake_log_output_channel';

export class FakeWindow {
  readonly onDidChangeVisibleTextEditorsEmitter = new vscode.EventEmitter<
    readonly vscode.TextEditor[]
  >();
  readonly onDidChangeVisibleTextEditors =
    this.onDidChangeVisibleTextEditorsEmitter.event;

  readonly outputChannels = new Map<string, FakeLogOutputChannel>();

  readonly showInformationMessage = jasmine.createSpy('showInformationMessage');
  readonly visibleTextEditors: vscode.TextEditor[] = [];
  readonly createTextEditorDecorationType = jasmine
    .createSpy('createTextEditorDecorationType')
    .and.returnValue({
      key: 'fake-decoration-type-key',
      dispose: () => {},
    });

  createOutputChannel(name: string): FakeLogOutputChannel {
    const channel = this.outputChannels.get(name);
    if (channel) {
      throw new Error(`Output channel ${name} already exists`);
    }
    const outputChannel = new FakeLogOutputChannel(name);
    this.outputChannels.set(name, outputChannel);
    return outputChannel;
  }
}
