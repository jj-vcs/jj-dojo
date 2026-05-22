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

import {describe, expect} from 'vitest';
import {activate} from './extension';
import {FakeExtensionContext} from './fakes/fake_extension_context';
import {FakeExtension} from './fakes/fake_extension';
import {vscode_test} from './testing/vscode_test';

describe('Extension', () => {
  vscode_test('should activate and log successfully', async ({log}) => {
    await activate(
      new FakeExtensionContext({
        extension: new FakeExtension({
          packageJSON: {
            build: 'test-version',
          },
        }),
      }),
    );
    expect(log.messages).toEqual([
      ['INFO', 'Extension version: test-version'],
      ['INFO', 'Extension activated successfully'],
    ]);
  });
});
