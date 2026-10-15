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
import {MultiSelectManager} from './multi_select_manager';
import {HashSet} from '../../utils/hashset';

const C1 = new CommitId('c1');
const C2 = new CommitId('c2');
const C3 = new CommitId('c3');
const C4 = new CommitId('c4');
const BASE = new CommitId('base');
const UNKNOWN = new CommitId('unknown');

describe('MultiSelectManager', () => {
  it('selects a single commit on normal click', () => {
    const manager = new MultiSelectManager<CommitId>();

    manager.onClick(C1, /* metaKey= */ false, /* shiftKey= */ false);
    expect([...manager.multiSelected]).toEqual([C1]);
    expect(manager.getOnlySelected()).toEqual(C1);

    manager.onClick(C2, /* metaKey= */ false, /* shiftKey= */ false);
    expect([...manager.multiSelected]).toEqual([C2]);
    expect(manager.getOnlySelected()).toEqual(C2);
  });

  it('toggles commits on meta-click', () => {
    const manager = new MultiSelectManager<CommitId>();

    manager.onClick(C1, /* metaKey= */ true, /* shiftKey= */ false);
    manager.onClick(C2, /* metaKey= */ true, /* shiftKey= */ false);
    expect([...manager.multiSelected]).toEqual([C1, C2]);
    expect(manager.getOnlySelected()).toBeUndefined();

    manager.onClick(C1, /* metaKey= */ true, /* shiftKey= */ false);
    expect([...manager.multiSelected]).toEqual([C2]);
    expect(manager.getOnlySelected()).toEqual(C2);

    manager.onClick(C2, /* metaKey= */ true, /* shiftKey= */ false);
    expect([...manager.multiSelected]).toEqual([]);
    expect(manager.getOnlySelected()).toBeUndefined();
  });

  it('selects an inclusive range on shift-click in both directions', () => {
    const manager = new MultiSelectManager<CommitId>();
    manager.setOrder([C4, C3, C2, C1, BASE]);

    manager.onClick(C3, /* metaKey= */ false, /* shiftKey= */ false);
    manager.onClick(C1, /* metaKey= */ false, /* shiftKey= */ true);
    expect([...manager.multiSelected]).toEqual([C3, C2, C1]);

    // Shift-clicking upwards from lastClicked ('c3') to 'c4' adds 'c4'.
    manager.onClick(C4, /* metaKey= */ false, /* shiftKey= */ true);
    expect([...manager.multiSelected]).toEqual([C3, C2, C1, C4]);
  });

  it('matches distinct CommitId instances by toString() key on shift-click', () => {
    const manager = new MultiSelectManager<CommitId>();
    manager.setOrder([C3, C2, C1]);

    manager.onClick(
      new CommitId('c3'),
      /* metaKey= */ false,
      /* shiftKey= */ false,
    );
    manager.onClick(
      new CommitId('c1'),
      /* metaKey= */ false,
      /* shiftKey= */ true,
    );
    expect([...manager.multiSelected]).toEqual([C3, C2, C1]);
  });

  it('falls back to single selection when shift-clicking without an order', () => {
    const manager = new MultiSelectManager<CommitId>();

    manager.onClick(C1, /* metaKey= */ false, /* shiftKey= */ false);
    manager.onClick(C2, /* metaKey= */ false, /* shiftKey= */ true);
    expect([...manager.multiSelected]).toEqual([C2]);
  });

  it('falls back to single selection when shift-clicking an unknown commit', () => {
    const manager = new MultiSelectManager<CommitId>();
    manager.setOrder([C1, C2]);

    manager.onClick(C1, /* metaKey= */ false, /* shiftKey= */ false);
    manager.onClick(UNKNOWN, /* metaKey= */ false, /* shiftKey= */ true);
    expect([...manager.multiSelected]).toEqual([UNKNOWN]);
  });

  it('anchors shift-click on a meta-deselected commit', () => {
    const manager = new MultiSelectManager<CommitId>();
    manager.setOrder([C4, C3, C2, C1, BASE]);

    // Given c4 and c3 are selected, and c3 is then deselected via meta-click.
    manager.onClick(C4, /* metaKey= */ false, /* shiftKey= */ false);
    manager.onClick(C3, /* metaKey= */ true, /* shiftKey= */ false);
    manager.onClick(C3, /* metaKey= */ true, /* shiftKey= */ false);

    // When shift-clicking c1, the range [c3..c1] is added from the c3 anchor.
    manager.onClick(C1, /* metaKey= */ false, /* shiftKey= */ true);
    expect([...manager.multiSelected]).toEqual([C4, C3, C2, C1]);
  });

  it('evicts missing commits and resets lastClicked when evicted', () => {
    const manager = new MultiSelectManager<CommitId>();
    manager.setOrder([C3, C2, C1, BASE]);

    // Given c1 and c3 are selected (with c3 as lastClicked) and c3 is evicted.
    manager.onClick(C1, /* metaKey= */ false, /* shiftKey= */ false);
    manager.onClick(C3, /* metaKey= */ true, /* shiftKey= */ false);
    manager.evictMissing(new HashSet([BASE, C1, C2]));
    expect([...manager.multiSelected]).toEqual([C1]);

    // When shift-clicking base after the anchor was evicted, it falls back to single selection.
    manager.onClick(BASE, /* metaKey= */ false, /* shiftKey= */ true);
    expect([...manager.multiSelected]).toEqual([BASE]);
  });
});
