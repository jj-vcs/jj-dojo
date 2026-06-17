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
import {createVscodeFakeImpl} from '../fakes/fake_vscode';
import {FakeLogOutputChannel} from '../fakes/fakes';

/**
 * The type of the fake vscode implementation. May expose additional
 * methods useful in testing.
 */
export type FakeVscode = ReturnType<typeof createVscodeFakeImpl>;

/**
 * Installs a fake vscode api
 */
export function installVscode() {
  const fakeVscode = initVscode();
  const log = initLog(fakeVscode);
  return {
    vscode,
    log,
  };
}

function initVscode(): FakeVscode {
  const vscodeImpl = createVscodeFakeImpl();
  Object.keys(vscodeImpl).forEach(key => {
    (vscode as Record<string, unknown>)[key] = (
      vscodeImpl as Record<string, unknown>
    )[key];
  });
  return vscodeImpl;
}

function initLog(fakeVscode: FakeVscode): FakeLogOutputChannel {
  // Register the 'JJ Extension' log channel.
  const log = new FakeLogOutputChannel('JJ Extension');
  fakeVscode.window.registerOutputChannel(log);
  return log;
}
