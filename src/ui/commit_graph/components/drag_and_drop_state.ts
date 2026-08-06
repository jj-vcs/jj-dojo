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

import {checkExhaustive} from '../utils/check';
import {CommitNode, InsertAction, SplitBookmarkChip} from '../api/types';
import {isMac} from './user_agent';

/** A callback that is called when the drag and drop state changes. */
export type SubscriberCallback = () => void;

/**  A drag and drop target. */
export type Target =
  | {
      // Represents a commit.
      type: 'commit';
      data: CommitNode;
    }
  | {
      // Represents the garbage section.
      type: 'garbageSection';
    }
  | {
      type: 'insert';
      data: InsertAction;
    }
  | {
      type: 'bookmark';
      data: {
        node: CommitNode;
        chip: SplitBookmarkChip;
      };
    };

/** Creates a target that represents a commit.  */
export function createCommitTarget(node: CommitNode): Target {
  return {
    type: 'commit',
    data: node,
  };
}

/** Creates a target that represents an insert action. */
export function createInsertTarget(
  action: InsertAction | undefined,
): Target | undefined {
  if (action === undefined) {
    return undefined;
  }
  return {
    type: 'insert',
    data: action,
  };
}

/** Creates a target that represents a bookmark. */
export function createBookmarkTarget(
  node: CommitNode,
  chip: SplitBookmarkChip,
): Target {
  return {
    type: 'bookmark',
    data: {node, chip},
  };
}

/** A target that represents the garbage section. */
export const GARBAGE_SECTION_TARGET: Target = {
  type: 'garbageSection',
};

/**
 * Returns whether the given targets are equal.
 */
export function isEqual(a: Target | undefined, b: Target | undefined) {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  switch (a.type) {
    case 'commit':
      return b.type === 'commit' && a.data === b.data;
    case 'garbageSection':
      return b.type === 'garbageSection';
    case 'insert':
      return (
        b.type === 'insert' &&
        a.data.from === b.data.from &&
        a.data.to === b.data.to
      );
    case 'bookmark':
      return (
        b.type === 'bookmark' &&
        a.data.node === b.data.node &&
        a.data.chip === b.data.chip
      );
    default:
      checkExhaustive(a);
  }
}

/**
 * Returns true if `dragged` is a commit and `hovered` is an insert action, and
 * the result of that drag is invalid or a no-op.
 */
export function isNoopInsert(
  draggedTarget: Target | undefined,
  hoveredTarget: Target | undefined,
): boolean {
  if (draggedTarget?.type === 'bookmark') {
    return (
      hoveredTarget?.type !== 'commit' ||
      draggedTarget.data.node === hoveredTarget.data
    );
  }
  if (draggedTarget?.type !== 'commit' || hoveredTarget?.type !== 'insert') {
    return false;
  }
  const dragged = draggedTarget.data;
  const {from, to} = hoveredTarget.data;

  if (from === undefined && dragged === to) {
    return true;
  }
  if (to === undefined && dragged === from) {
    return true;
  }

  // It is not possible to insert a commit before an immutable commit.
  if (
    to?.isImmutable ||
    (to === undefined && from?.children.some((child) => child.node.isImmutable))
  ) {
    return true;
  }

  return from === dragged || to === dragged;
}

/**
 * A class that stores the current drag and drop state, and notifies subscribers
 * when the state changes. This allows multiple elements to publish their state,
 * and other elements to subscribe to the state and react to it.
 */
export class DragAndDropStateManager {
  // The target that is currently being dragged.
  private dragged?: Target;

  // The target that is currently being hovered over.
  private readonly hovered: Array<{
    target: Target;
    // HTML Drag and drop events can fire multiple enter events for the same
    // element. e.g. We could get enter, enter, leave. This counter tracks how
    // many enter events we've gotten for the target, minus the number of leave
    // events. This is the most reliable way to tell whether the cursor is still
    // over the target.
    counter: number;
  }> = [];

  private readonly subscribers = new Set<SubscriberCallback>();

  getDragged(): Target | undefined {
    return this.dragged;
  }

  getHovered(): Target | undefined {
    return this.hovered[this.hovered.length - 1]?.target;
  }

  /**
   * Handles the start of a drag event.
   *
   * Any element that wants to support the start of a drag should call this
   * function in its @dragstart event handler.
   *
   * @param event: Required except in tests. The drag event.
   */
  onDragStart(event: DragEvent | undefined, target: Target) {
    event?.stopPropagation();
    if (event) {
      // On Mac, dragging results in a green plus icon being shown besides the
      // cursor. It is a bit annoying, and can be disabled by setting
      // `event.dataTransfer.effectAllowed`.
      // However, setting that causes cursors on Linux to flicker. It constantly
      // switches between the grab cursor and the forbidden cursor.
      if (isMac()) {
        disableGreenPlusIcon(event);
      }
    }
    this.dragged = target;
    this.informSubscribers();
  }

  /**
   * Handles the end of a drag event.
   *
   * Any element that calls onDragStart on @dragstart should also call this
   * function in its @dragend event handler.
   */
  onDragEnd(event: DragEvent): {source: Target; dest: Target} | undefined {
    event.stopPropagation();
    let response;
    const source = this.dragged;
    const dest = this.getHovered();
    if (source !== undefined && dest !== undefined) {
      response = {source, dest};
    }
    this.dragged = undefined;
    this.hovered.length = 0;
    this.informSubscribers();
    return response;
  }

  /**
   * Handles the enter event of a drag event.
   *
   * Any element that wants to make hovering over it change how the graph is
   * rendered should call this function in its @dragenter event handler.
   */
  onDragEnter(event: DragEvent, target: Target) {
    if (this.dragged === undefined || isEqual(target, this.dragged)) {
      return;
    }
    // Don't show multi-selected commits as a drop target.
    if (isMultiSelected(this.dragged) && isMultiSelected(target)) {
      return;
    }

    const hovered = this.hovered[this.hovered.length - 1];
    if (hovered !== undefined && isEqual(target, hovered.target)) {
      hovered.counter += 1;
      return;
    }

    this.hovered.push({
      target,
      counter: 1,
    });
    this.informSubscribers();
  }

  onDragOver(event: DragEvent) {
    // Needed to avoid lag when dragging.
    event.preventDefault();
  }

  onDragLeave(event: DragEvent, target: Target) {
    for (let i = 0; i < this.hovered.length; i++) {
      const hovered = this.hovered[i];
      if (isEqual(hovered.target, target)) {
        hovered.counter -= 1;
        if (hovered.counter === 0) {
          this.hovered.splice(i, 1);
          this.informSubscribers();
        }
        return;
      }
    }
  }

  private informSubscribers() {
    for (const cb of this.subscribers) {
      cb();
    }
  }

  subscribe(callback: SubscriberCallback) {
    if (this.subscribers.has(callback)) {
      throw new Error('Callback is already subscribed.');
    }
    this.subscribers.add(callback);
  }

  unsubscribe(callback: SubscriberCallback) {
    if (!this.subscribers.delete(callback)) {
      throw new Error('Callback was not subscribed.');
    }
  }
}

const globalDragAndDropStateManager = new DragAndDropStateManager();

/**
 * Returns the global drag and drop manager.
 */
export function getManager() {
  return globalDragAndDropStateManager;
}

function disableGreenPlusIcon(event: DragEvent) {
  if (!event.dataTransfer) {
    throw new Error('No dataTransfer in DragEvent');
  }
  // Hides the green plus icon shown when hovered over some elements.
  event.dataTransfer.effectAllowed = 'move';
}

function isMultiSelected(target: Target) {
  return target.type === 'commit' && target.data.isMultiSelected;
}
