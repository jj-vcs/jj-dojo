/**
 * Copyright 2026 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as vscode from 'vscode';
import {URI} from 'vscode-uri';

import * as vscodeEnums from '../../third_party/vscode/vscode_enums';

import {
  FakeCancellationTokenSource,
  FakeCodeLens,
  FakeCommands,
  FakeDisposable,
  FakeEventEmitter,
  FakeLanguages,
  FakeLogOutputChannel,
  FakePosition,
  FakeRange,
  FakeSelection,
  FakeThemeColor,
  FakeWindow,
  FakeWorkspace,
} from './fakes';

export type FakeVscode = ReturnType<typeof installVscode>;

export function logs() {
  return fakeVscode().window.outputChannels.get('JJ Extension')!;
}

export function fakeVscode() {
  return vscode as unknown as FakeVscode;
}

/**
 * Installs a fake vscode api
 */
export function installVscode() {
  // Cast types to Record<string, unknown> to allow us to dynamically assign
  // properties to the vscode object.
  const vscodeAsRecord = vscode as Record<string, unknown>;

  // Assign the enums first, so subsequent code can reference them using
  // vscode.EnumName.
  Object.keys(vscodeEnums).forEach(key => {
    vscodeAsRecord[key] = (vscodeEnums as Record<string, unknown>)[key];
  });

  // Assign the basic classes, so subsequent code can reference them using
  // vscode.ClassName.
  const basicClasses = {
    CancellationTokenSource: FakeCancellationTokenSource,
    CodeLens: FakeCodeLens,
    Disposable: FakeDisposable,
    Position: FakePosition,
    Range: FakeRange,
    Selection: FakeSelection,
    ThemeColor: FakeThemeColor,
    Uri: URI,
    EventEmitter: FakeEventEmitter,
    LogOutputChannel: FakeLogOutputChannel,
  };
  Object.keys(basicClasses).forEach(key => {
    vscodeAsRecord[key] = (basicClasses as Record<string, unknown>)[key];
  });

  // Assign the rest of the classes.
  const restOfClasses = {
    workspace: new FakeWorkspace(),
    languages: new FakeLanguages(),
    commands: new FakeCommands(),
    window: new FakeWindow(),
  };
  Object.keys(restOfClasses).forEach(key => {
    vscodeAsRecord[key] = (restOfClasses as Record<string, unknown>)[key];
  });

  return vscode as unknown as typeof basicClasses &
    typeof restOfClasses &
    typeof vscodeEnums;
}
