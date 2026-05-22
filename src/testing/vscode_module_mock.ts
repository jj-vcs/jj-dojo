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

import {vi} from 'vitest';

// Without this, tests would fail with `Cannot find package 'vscode' ...`
// because they can't import the vscode module.
//
// To fix this, we utilize vitest's module mocking feature
// https://vitest.dev/guide/mocking/modules.html#mocking-a-module
// to replace it with an empty object {} instead. Each test is then
// responsibile of populating the empty object with fake fields
// and fake implementations.
//
// Please see `vscode_test.ts` as well. That file provides a
// vscode_test rule that automatically clears out all fields in the
// global empty object, and replace them with a clean fake implemenation
// before each test.
vi.mock(import('vscode'), () => {
  return {} as typeof import('vscode');
});
