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

import * as Module from 'module';

// Without this, tests would fail with `Cannot find package 'vscode' ...`
// because they can't import the vscode module.
//
// To fix this, we override the module require to return a single cached
// empty object when 'vscode' is requested. Each test is then responsible
// of populating the empty object with fake fields and fake implementations.
//
// Please see `vscode_test.ts` as well. That file provides setup/teardown
// helpers to clear out all fields in the global empty object, and replace
// them with a clean fake implementation before each test.
const fakeVscode = {} as unknown as typeof import('vscode');

// Setting __esModule: true is crucial because it instructs the compiled
// JavaScript files to treat your mock as an ES module, allowing
// import * as vscode from 'vscode' or import vscode from 'vscode'
// to resolve correctly.
Object.defineProperty(fakeVscode, '__esModule', {
  value: true,
});
const originalRequire = Module.prototype.require;
/* eslint-disable  @typescript-eslint/no-explicit-any */
(Module as any).prototype.require = function (
  this: unknown,
  id: string,
  ...args: unknown[]
) {
  if (id === 'vscode') {
    return fakeVscode;
  }
  return (originalRequire as (...args: unknown[]) => unknown).apply(this, [
    id,
    ...args,
  ]);
};
