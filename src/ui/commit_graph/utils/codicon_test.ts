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

import 'jasmine';
import {parseCodicon} from './codicon';

describe('parseCodicon', () => {
  it('sets spin:true for a codicon with ~spin', () => {
    expect(parseCodicon('loading~spin')).toEqual({name: 'loading', spin: true});
  });

  it('sets spin:false for a codicon without ~spin', () => {
    expect(parseCodicon('loading')).toEqual({name: 'loading', spin: false});
  });

  it('removes the codicon- prefix when provided', () => {
    expect(parseCodicon('codicon-loading~spin')).toEqual({
      name: 'loading',
      spin: true,
    });
    expect(parseCodicon('codicon-loading')).toEqual({
      name: 'loading',
      spin: false,
    });
  });

  it('ignores other suffixes', () => {
    expect(parseCodicon('loading~foo')).toEqual({
      name: 'loading~foo',
      spin: false,
    });
  });

  it('ignores other prefixes', () => {
    expect(parseCodicon('foo-loading')).toEqual({
      name: 'foo-loading',
      spin: false,
    });
  });
});
