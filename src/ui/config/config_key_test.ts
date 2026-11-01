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
import {installVscode} from '../../testing/install_vscode';
import {parseConfigKey} from './config_key';

describe('parseConfigKey', () => {
  beforeEach(installVscode);

  const run = parseConfigKey;
  it('splits correctly', () => {
    expect(run('section.key')).toEqual(['section', 'key']);
    expect(run('section.key.subKey')).toEqual(['section', 'key.subKey']);
    expect(() => run('')).toThrowError(/Invalid config key/);
    expect(() => run('section')).toThrowError(/Invalid config key/);
    expect(() => run('section.')).toThrowError(/Invalid config key/);
    expect(() => run('.key')).toThrowError(/Invalid config key/);
  });
});
