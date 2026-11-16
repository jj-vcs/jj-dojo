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

/// <reference types="node" />

import 'jasmine';
import process from 'node:process';
import {subprocess} from './subprocess_util';

describe('SubprocessUtil', () => {
  it('executes configured jj binary version from PATH in test environment', async () => {
    const expectedVersion = process.env.JJ_VERSION;
    expect(expectedVersion).toBeDefined();

    const result = await subprocess({
      cwd: process.cwd(),
      command: 'jj',
      args: ['version'],
    });
    const bareVersion = expectedVersion!
      .replace(/^v/, '')
      .replace(/\./g, '\\.');
    expect(result.stdout).toMatch(new RegExp(`^jj ${bareVersion}(?:[-\\s]|$)`));
  });
});
