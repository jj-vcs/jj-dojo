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
import {getFocusedCommits} from './focus_mode';
import {newCommit} from './test_utils';

describe('getFocusedCommits', () => {
  it('returns the working copy commit, its ancestors, and its descendants', () => {
    // `p4base-ancestor`, `a`, `b` should be excluded from the result.
    // Graph:
    //  o g
    //  │
    //  o f (working copy commit)
    //  │
    //  │  o h
    //  ├──┘
    //  o──┐ e
    //  │  │
    //  o  │ c
    //  │  │
    //  │  o d
    //  ├──┘
    //  │  o b
    //  ├──┘
    //  ◆ p4base
    //  │  o a
    //  ├──┘
    //  ◆ p4base-ancestor

    const commits = [
      newCommit('p4base-ancestor', ['p4base', 'a'], {
        isImmutable: true,
      }),
      newCommit('a', []),
      newCommit('p4base', ['b', 'c', 'd'], {
        isImmutable: true,
      }),
      newCommit('b', []),
      newCommit('c', ['e']),
      newCommit('d', ['e']),
      newCommit('e', ['f', 'h']),
      newCommit('f', ['g'], {
        active: true,
      }),
      newCommit('g', []),
      newCommit('h', []),
    ];
    expect(getFocusedCommits(commits)).toEqual([
      newCommit('p4base', ['c', 'd'], {
        isImmutable: true,
      }),
      newCommit('c', ['e']),
      newCommit('d', ['e']),
      newCommit('e', ['f', 'h']),
      newCommit('f', ['g'], {
        active: true,
      }),
      newCommit('g', []),
      newCommit('h', []),
    ]);
  });
});
