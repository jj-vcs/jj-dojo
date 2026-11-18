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
import {getDisplayIdHighlightLength} from './display_id_search';

describe('getDisplayIdHighlightLength', () => {
  const fullChangeId = 'trvwpslsvokquqwosonynmnlwsnmkwpp';

  it('returns undefined when query or displayId is empty', () => {
    expect(
      getDisplayIdHighlightLength('trvw', fullChangeId, ''),
    ).toBeUndefined();
    expect(
      getDisplayIdHighlightLength('', fullChangeId, 'trvw'),
    ).toBeUndefined();
  });

  it('highlights the matched prefix when query is shorter than or equal to displayId', () => {
    expect(getDisplayIdHighlightLength('trvw', fullChangeId, 't')).toBe(1);
    expect(getDisplayIdHighlightLength('trvw', fullChangeId, 'tr')).toBe(2);
    expect(getDisplayIdHighlightLength('trvw', fullChangeId, 'trvw')).toBe(4);
  });

  it('highlights only the displayed text when query matches a longer changeId prefix', () => {
    expect(getDisplayIdHighlightLength('trvw', fullChangeId, 'trvwpsls')).toBe(
      4,
    );
    expect(
      getDisplayIdHighlightLength(
        'trvw',
        fullChangeId,
        'trvwpslsvokquqwosonynmnlwsnmkwpp',
      ),
    ).toBe(4);
  });

  it('ignores non-prefix substrings of displayId and changeId', () => {
    expect(
      getDisplayIdHighlightLength('trvw', fullChangeId, 'rvw'),
    ).toBeUndefined();
    expect(
      getDisplayIdHighlightLength('trvw', fullChangeId, 'wpsls'),
    ).toBeUndefined();
    expect(
      getDisplayIdHighlightLength('trvw', fullChangeId, 'trvwxxxx'),
    ).toBeUndefined();
  });

  it('highlights displayed ID or divergence offset appropriately on diverged commits', () => {
    expect(
      getDisplayIdHighlightLength('trvw/0', fullChangeId, 'trvwpsls'),
    ).toBe(4);
    expect(getDisplayIdHighlightLength('trvw/0', fullChangeId, 'trvw/0')).toBe(
      6,
    );
    expect(
      getDisplayIdHighlightLength('trvw/0', fullChangeId, 'trvwpsls/'),
    ).toBe(5);
    expect(
      getDisplayIdHighlightLength('trvw/0', fullChangeId, 'trvwpsls/0'),
    ).toBe(6);
    expect(
      getDisplayIdHighlightLength('trvw/0', fullChangeId, 'trvwpsls/1'),
    ).toBeUndefined();
    expect(
      getDisplayIdHighlightLength('trvw/0', fullChangeId, 't/'),
    ).toBeUndefined();
    expect(
      getDisplayIdHighlightLength('trvw/0', fullChangeId, 'tr/0'),
    ).toBeUndefined();
    expect(
      getDisplayIdHighlightLength('trvw/10', fullChangeId, 'trvwpsls/1'),
    ).toBe(6);
    expect(
      getDisplayIdHighlightLength('trvw/10', fullChangeId, 'trvwpsls/10'),
    ).toBe(7);
    expect(
      getDisplayIdHighlightLength('trvw/10', fullChangeId, 'trvwpsls/100'),
    ).toBeUndefined();
  });

  it('matches case-insensitively when displayId or changeId contains uppercase characters', () => {
    const upperChangeId = fullChangeId.toUpperCase();
    expect(getDisplayIdHighlightLength('TRVW', upperChangeId, 'tr')).toBe(2);
    expect(getDisplayIdHighlightLength('TRVW', upperChangeId, 'trvwpsls')).toBe(
      4,
    );
    expect(
      getDisplayIdHighlightLength('TRVW/0', upperChangeId, 'trvwpsls/0'),
    ).toBe(6);
  });

  it('falls back to displayId prefix matching when changeId is undefined', () => {
    expect(getDisplayIdHighlightLength('abcdef1', undefined, 'abc')).toBe(3);
    expect(
      getDisplayIdHighlightLength('abcdef1', undefined, 'abcdef1234'),
    ).toBeUndefined();
  });

  it('ignores changeId when displayId is not a prefix of changeId', () => {
    expect(getDisplayIdHighlightLength('abcd', fullChangeId, 'ab')).toBe(2);
    expect(
      getDisplayIdHighlightLength('abcd', fullChangeId, 'tr'),
    ).toBeUndefined();
    expect(
      getDisplayIdHighlightLength('abcd/0', fullChangeId, 'trvwpsls/0'),
    ).toBeUndefined();
  });
});
