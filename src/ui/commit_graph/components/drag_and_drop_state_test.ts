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
import {CommitNode} from '../api/types';
import {
  DragAndDropStateManager,
  createCommitTarget,
  isNoopInsert,
} from './drag_and_drop_state';

/** Creates a fake CommitNode for testing. */
function newCommitNode(node: Partial<CommitNode>): CommitNode {
  return {
    hash: '',
    childrenHashes: [],
    shortDescription: '',
    fullDescription: '',
    isEmpty: false,
    bookmarkChips: [],
    displayId: '',
    highlightedDisplayIdLen: 0,
    updateTime: 0,
    isMultiSelected: false,
    children: [],
    parents: [],
    isMagicRoot: false,
    disjointSetId: 0,
    descendants: new Set<string>(),
    traverseOrder: 0,
    smallestTraverseOrder: 0,
    x: 0,
    y: 0,
    tileGroups: [],
    occupiedColumns: 0,
    ...node,
  };
}

describe('DragAndDropState', () => {
  const fakeEvent = jasmine.createSpyObj<DragEvent>('DragEvent', [
    'stopPropagation',
    'preventDefault',
  ]);

  it('Drag the source node, and hover over it', () => {
    const manager = new DragAndDropStateManager();
    let count = 0;
    const cb = () => {
      ++count;
    };

    const draggedNode = createCommitTarget(newCommitNode({hash: 'source'}));

    // onDragStart on the source node.
    manager.subscribe(cb);
    expect(count).toEqual(0);
    manager.onDragStart(undefined, draggedNode);
    expect(count).toEqual(1);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toBeUndefined();

    // onDragEnter on the dragged node is a no-op, and should not increase the
    // count.
    manager.onDragEnter(fakeEvent, draggedNode);
    expect(count).toEqual(1);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toBeUndefined();

    // onDragLeave on the dragged node is a no-op, and should not increase the
    // count.
    manager.onDragLeave(fakeEvent, draggedNode);
    expect(count).toEqual(1);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toBeUndefined();
  });

  it('Drag a multi-selected source node, and hover over another multi-selected node', () => {
    const manager = new DragAndDropStateManager();
    let count = 0;
    const cb = () => {
      ++count;
    };

    const draggedNode = createCommitTarget(
      // The dragged node should be multi-selected.
      newCommitNode({hash: 'source', isMultiSelected: true}),
    );
    manager.subscribe(cb);
    manager.onDragStart(undefined, draggedNode);
    expect(count).toEqual(1);

    // onDragEnter on multi-selected node is also a no-op.
    manager.onDragEnter(
      fakeEvent,
      createCommitTarget(
        newCommitNode({hash: 'multi-selected', isMultiSelected: true}),
      ),
    );
    expect(count).toEqual(1);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toBeUndefined();
  });

  it('Drag over the source node, and hover over another node', () => {
    const manager = new DragAndDropStateManager();
    let count = 0;
    const cb = () => {
      ++count;
    };

    const draggedNode = createCommitTarget(newCommitNode({hash: 'source'}));
    const hoveredNode = createCommitTarget(newCommitNode({hash: 'hovered'}));

    // onDragStart on the source node.
    manager.subscribe(cb);
    expect(count).toEqual(0);
    manager.onDragStart(undefined, draggedNode);
    expect(count).toEqual(1);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toBeUndefined();

    // onDragEnter on another node.
    manager.onDragEnter(fakeEvent, hoveredNode);
    expect(count).toEqual(2);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toEqual(hoveredNode);

    // A second onDragEnter on the same node should not break things.
    // Note: This can happen in practice. HTML Drag and drop events can fire
    // multiple enter events for the same node. e.g. We could get enter, enter,
    // leave.
    manager.onDragEnter(fakeEvent, hoveredNode);
    expect(count).toEqual(2);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toEqual(hoveredNode);

    // Element should still be considered hovered after the first onDragLeave event.
    manager.onDragLeave(fakeEvent, hoveredNode);
    expect(count).toEqual(2);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toEqual(hoveredNode);

    // Second onDragLeave should clear the hovered node.
    manager.onDragLeave(fakeEvent, hoveredNode);
    expect(count).toEqual(3);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toBeUndefined();
  });

  it('Drag the source node, and drop it', () => {
    const manager = new DragAndDropStateManager();
    let count = 0;
    const cb = () => {
      ++count;
    };

    const draggedNode = createCommitTarget(newCommitNode({hash: 'source'}));
    const hoveredNode = createCommitTarget(newCommitNode({hash: 'hovered'}));

    // onDragStart on the source node.
    manager.subscribe(cb);
    expect(count).toEqual(0);
    manager.onDragStart(undefined, draggedNode);
    expect(count).toEqual(1);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toBeUndefined();

    // onDragEnter on another node.
    manager.onDragEnter(fakeEvent, hoveredNode);
    expect(count).toEqual(2);
    expect(manager.getDragged()).toEqual(draggedNode);
    expect(manager.getHovered()).toEqual(hoveredNode);

    // onDragEnd should clear both the dragged and hovered nodes.
    expect(manager.onDragEnd(fakeEvent)).toEqual({
      source: draggedNode,
      dest: hoveredNode,
    });
    expect(count).toEqual(3);
    expect(manager.getDragged()).toBeUndefined();
    expect(manager.getHovered()).toBeUndefined();
  });

  it('subscribes and unsubscribes correctly', () => {
    const manager = new DragAndDropStateManager();
    const cb = () => {};
    manager.subscribe(cb);
    manager.unsubscribe(cb);
    expect(() => {
      manager.unsubscribe(cb);
    }).toThrowError('Callback was not subscribed.');
  });

  it('throws error when subscribing twice', () => {
    const manager = new DragAndDropStateManager();
    const cb = () => {};
    manager.subscribe(cb);
    expect(() => {
      manager.subscribe(cb);
    }).toThrowError('Callback is already subscribed.');
  });

  it('throws error when unsubscribing something that was not subscribed', () => {
    const manager = new DragAndDropStateManager();
    const cb = () => {};
    expect(() => {
      manager.unsubscribe(cb);
    }).toThrowError('Callback was not subscribed.');
  });
});

describe('isNoopInsert', () => {
  it('returns true if from is undefined and dragged is to', () => {
    const node = newCommitNode({hash: 'node'});
    const dragged = {type: 'commit', data: node} as const;
    const hovered = {
      type: 'insert',
      data: {
        from: undefined,
        to: node,
        insertNode: {x: 0, y: 0},
        insertHint: {x: 0, y: 0},
      },
    } as const;
    expect(isNoopInsert(dragged, hovered)).toBeTrue();
  });

  it('returns true if to is undefined and dragged is from', () => {
    const node = newCommitNode({hash: 'node'});
    const dragged = {type: 'commit', data: node} as const;
    const hovered = {
      type: 'insert',
      data: {
        from: node,
        to: undefined,
        insertNode: {x: 0, y: 0},
        insertHint: {x: 0, y: 0},
      },
    } as const;
    expect(isNoopInsert(dragged, hovered)).toBeTrue();
  });

  it('returns true if to is immutable', () => {
    const dragged = {
      type: 'commit',
      data: newCommitNode({hash: 'dragged'}),
    } as const;
    const to = newCommitNode({hash: 'to', isImmutable: true});
    const hovered = {
      type: 'insert',
      data: {
        from: undefined,
        to,
        insertNode: {x: 0, y: 0},
        insertHint: {x: 0, y: 0},
      },
    } as const;
    expect(isNoopInsert(dragged, hovered)).toBeTrue();
  });

  it('returns true if to is undefined and from has an immutable child', () => {
    const immutableChild = newCommitNode({
      hash: 'immutable',
      isImmutable: true,
    });
    const dragged = {
      type: 'commit',
      data: newCommitNode({hash: 'dragged'}),
    } as const;
    const hovered = {
      type: 'insert',
      data: {
        from: newCommitNode({
          hash: 'from',
          children: [{node: immutableChild, lineX: 0}],
        }),
        to: undefined,
        insertNode: {x: 0, y: 0},
        insertHint: {x: 0, y: 0},
      },
    } as const;
    expect(isNoopInsert(dragged, hovered)).toBeTrue();
  });

  it('returns true if from is dragged', () => {
    const node = newCommitNode({hash: 'node'});
    const dragged = {type: 'commit', data: node} as const;
    const hovered = {
      type: 'insert',
      data: {
        from: node,
        to: newCommitNode({hash: 'to'}),
        insertNode: {x: 0, y: 0},
        insertHint: {x: 0, y: 0},
      },
    } as const;
    expect(isNoopInsert(dragged, hovered)).toBeTrue();
  });

  it('returns true if to is dragged', () => {
    const node = newCommitNode({hash: 'node'});
    const dragged = {type: 'commit', data: node} as const;
    const hovered = {
      type: 'insert',
      data: {
        from: newCommitNode({hash: 'from'}),
        to: node,
        insertNode: {x: 0, y: 0},
        insertHint: {x: 0, y: 0},
      },
    } as const;
    expect(isNoopInsert(dragged, hovered)).toBeTrue();
  });

  it('returns false for a valid insert', () => {
    const dragged = {
      type: 'commit',
      data: newCommitNode({hash: 'dragged'}),
    } as const;
    const hovered = {
      type: 'insert',
      data: {
        from: newCommitNode({hash: 'from'}),
        to: newCommitNode({hash: 'to'}),
        insertNode: {x: 0, y: 0},
        insertHint: {x: 0, y: 0},
      },
    } as const;
    expect(isNoopInsert(dragged, hovered)).toBeFalse();
  });
});
