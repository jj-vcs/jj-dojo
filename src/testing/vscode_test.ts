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

import {test} from 'vitest';
import * as vscode from 'vscode';
import {createVscodeFakeImpl} from '../fakes/fake_vscode';
import {FakeLogOutputChannel} from '../fakes/fakes';

/**
 * The type of the fake vscode implementation. May expose additional
 * methods useful in testing.
 */
export type FakeVscode = ReturnType<typeof createVscodeFakeImpl>;

/**
 * A custom test setup that injects a new fake `vscode` implementation
 * before each test and cleans it up afterwards.
 *
 * See https://vitest.dev/guide/test-context.html#extend-test-context for
 * the Vitest's `extend` documentation.
 */
export const vscode_test = test.extend<{
  vscode: FakeVscode;
  log: FakeLogOutputChannel;
}>({
  vscode: [
    async ({}, use) => {
      // Provide a new, clean fake implemenation before each test.
      await use(setupVscode());
      // Clean things up.
      deleteVscode();
    },
    {auto: true},
  ],
  log: [
    async ({}, use) => {
      const fakeVscode = vscode as unknown as FakeVscode;
      const logger = new FakeLogOutputChannel('JJ Extension');
      fakeVscode.window.registerOutputChannel(logger);
      await use(logger);
    },
    {auto: true},
  ],
});

function setupVscode(): FakeVscode {
  const vscodeImpl = createVscodeFakeImpl();
  Object.keys(vscodeImpl).forEach(key => {
    (vscode as Record<string, unknown>)[key] = (
      vscodeImpl as Record<string, unknown>
    )[key];
  });
  return vscodeImpl;
}

function deleteVscode() {
  Object.keys(vscode).forEach(key => {
    (vscode as Record<string, unknown>)[key] = undefined;
  });
}
