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
import {CommitId} from '../../api/api';
import {fakeCommit} from '../../testing/fakes';
import {CommitOrderManager} from './commit_order_manager';

describe('CommitOrderManager', () => {
  describe('setOrder', () => {
    it('preserves order when wcCommitIndex is 0', () => {
      const manager = new CommitOrderManager();
      const ids = [new CommitId('A'), new CommitId('B'), new CommitId('C')];
      manager.setOrder(ids, 0); // A is working copy
      const commits = [
        fakeCommit({id: new CommitId('A'), updateTime: 0, displayId: 'A'}),
        fakeCommit({id: new CommitId('B'), updateTime: 0, displayId: 'B'}),
        fakeCommit({id: new CommitId('C'), updateTime: 0, displayId: 'C'}),
      ];
      manager.sortCommits(commits);
      expect(commits.map((c) => c.id.hex)).toEqual(['A', 'B', 'C']);
    });

    it('rotates order when wcCommitIndex > 0', () => {
      const manager = new CommitOrderManager();
      const ids = [new CommitId('A'), new CommitId('B'), new CommitId('C')];
      manager.setOrder(ids, 1); // B is working copy
      const commits = [
        fakeCommit({id: new CommitId('A'), updateTime: 0, displayId: 'A'}),
        fakeCommit({id: new CommitId('B'), updateTime: 0, displayId: 'B'}),
        fakeCommit({id: new CommitId('C'), updateTime: 0, displayId: 'C'}),
      ];
      manager.sortCommits(commits);
      expect(commits.map((c) => c.id.hex)).toEqual(['B', 'C', 'A']);
    });

    it('throws an error and preserves order when wcCommitIndex is negative', () => {
      const manager = new CommitOrderManager();
      const ids = [new CommitId('B'), new CommitId('A')];
      manager.setOrder(ids, 0);
      expect(() => manager.setOrder(ids, -1)).toThrowError(
        'wcCommitIndex (-1) is out of bounds for topToBottomOrder of length 2',
      );

      const commits = [
        fakeCommit({id: new CommitId('A'), updateTime: 0, displayId: 'A'}),
        fakeCommit({id: new CommitId('B'), updateTime: 0, displayId: 'B'}),
      ];
      manager.sortCommits(commits);
      expect(commits.map((c) => c.id.hex)).toEqual(['B', 'A']);
    });

    it('throws an error and preserves order when wcCommitIndex is out of bounds', () => {
      const manager = new CommitOrderManager();
      const ids = [new CommitId('B'), new CommitId('A')];
      manager.setOrder(ids, 0);
      expect(() => manager.setOrder(ids, 2)).toThrowError(
        'wcCommitIndex (2) is out of bounds for topToBottomOrder of length 2',
      );

      const commits = [
        fakeCommit({id: new CommitId('A'), updateTime: 0, displayId: 'A'}),
        fakeCommit({id: new CommitId('B'), updateTime: 0, displayId: 'B'}),
      ];
      manager.sortCommits(commits);
      expect(commits.map((c) => c.id.hex)).toEqual(['B', 'A']);
    });
  });

  describe('sortCommits', () => {
    it('sorts known commits', () => {
      const manager = new CommitOrderManager();
      const ids = [new CommitId('A'), new CommitId('B'), new CommitId('C')];
      manager.setOrder(ids, 0);

      const commits = [
        fakeCommit({id: new CommitId('C'), updateTime: 0, displayId: 'C'}),
        fakeCommit({id: new CommitId('A'), updateTime: 0, displayId: 'A'}),
        fakeCommit({id: new CommitId('B'), updateTime: 0, displayId: 'B'}),
      ];

      manager.sortCommits(commits);

      expect(commits.map((c) => c.id.hex)).toEqual(['A', 'B', 'C']);
    });

    it('places unknown commits at the end', () => {
      const manager = new CommitOrderManager();
      const ids = [new CommitId('B'), new CommitId('C')];
      manager.setOrder(ids, 0);

      const commits = [
        fakeCommit({id: new CommitId('A'), updateTime: 0, displayId: 'A'}),
        fakeCommit({id: new CommitId('B'), updateTime: 0, displayId: 'B'}),
        fakeCommit({id: new CommitId('C'), updateTime: 0, displayId: 'C'}),
        fakeCommit({id: new CommitId('D'), updateTime: 0, displayId: 'D'}),
      ];

      manager.sortCommits(commits);

      // known commits first, then unknown commits sorted by updateTime then displayId.
      expect(commits.map((c) => c.id.hex)).toEqual(['B', 'C', 'A', 'D']);
    });

    it('sorts unknown commits by updateTime', () => {
      const manager = new CommitOrderManager();
      const commits = [
        fakeCommit({id: new CommitId('B'), updateTime: 200, displayId: 'B'}),
        fakeCommit({id: new CommitId('A'), updateTime: 100, displayId: 'A'}),
      ];

      manager.sortCommits(commits);

      expect(commits.map((c) => c.id.hex)).toEqual(['A', 'B']);
    });

    it('sorts unknown commits by displayId when updateTime is same', () => {
      const manager = new CommitOrderManager();
      const commits = [
        fakeCommit({id: new CommitId('B'), updateTime: 100, displayId: 'B'}),
        fakeCommit({id: new CommitId('A'), updateTime: 100, displayId: 'A'}),
      ];

      manager.sortCommits(commits);

      expect(commits.map((c) => c.id.hex)).toEqual(['A', 'B']);
    });
  });
});
