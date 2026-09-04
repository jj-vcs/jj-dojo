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
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators';
import {classMap} from 'lit/directives/class-map';
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState, CommitNode, SplitChip} from '../api/types';
import {JjCommitRowSplitChip} from './commit_row_chip';
import type {Target} from './drag_and_drop_state';
import {getManager, isNoopInsert} from './drag_and_drop_state';

/**
 * A component that enables dragging and dropping of its children.
 *
 * Once wrapped in this component, the children of this component will be
 * draggable, and dragging them will trigger events sent to the
 * DragAndDropStateManager.
 *
 * Any element that intends to react to such drag and drop events should extend
 * JjDragAndDropSubscriber. See drag_and_drop_subscriber.ts for more details.
 *
 * Usage:
 * <jj-drag-and-drop-publisher>
 *   <your-component draggable="${isDraggable(...)}"></your-component>
 * </jj-drag-and-drop-publisher>
 */
@customElement('jj-drag-and-drop-publisher')
class JjDragAndDropPublisher extends LitElement {
  // If defined, any drag and drop events to this LitElement will be associated
  // with this target. If undefined, dragging and dropping will be disabled.
  @property({attribute: false}) publishedTarget?: Target;
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;

  static override styles = css`
    :host {
      height: 100%;
    }
    div {
      width: 100%;
      height: 100%;
    }
    .isDraggable {
      cursor: grab;
      width: 100%;
    }
  `;

  override render() {
    const target = this.publishedTarget;
    if (target === undefined) {
      return html`<div draggable="false"><slot></slot></div>`;
    }
    const classes = classMap({
      isDraggable: isDraggable(target, this.state),
    });

    const draggable = isDraggable(target, this.state);
    return html`
      <div
        class="${classes}"
        draggable="${draggable}"
        @dragstart=${(event: DragEvent) => {
          if (!draggable) {
            // The browser can still fire dragstart even if the draggable
            // attribute is set to false.
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          let dragImage: HTMLElement | undefined;
          switch (target.type) {
            case 'chip':
              dragImage = this.getBookmarkDragImage(target.data.chip);
              break;
            case 'commit':
              dragImage = this.getBlankImage();
              break;
            default:
              break;
          }
          if (dragImage) {
            this.setDragImage(event, dragImage);
          }

          getManager().onDragStart(event, target);
        }}
        @dragend=${async (event: DragEvent) => {
          event.stopPropagation();
          try {
            await this.handleDragEnd();
          } finally {
            getManager().onDragEnd(event);
          }
        }}
        @dragenter=${(event: DragEvent) => {
          getManager().onDragEnter(event, target);
        }}
        @dragleave=${(event: DragEvent) => {
          // This is a sad but working hack.
          // Mostly on Linux, the dragleave event is fired before the dragend
          // event. This causes bugs like b/440334795 where the graph considers
          // the drag as aborted since it thinks it's not hovering over any
          // element. To fix this, we delay the dragleave event by 10ms. This is
          // long enough to guarantee the dragend event is fired. It also does
          // not cause a user-noticeable delay in the UI, since:
          //   1) we already use dragenter as the signal to update the 'rebase here' bubble
          //   2) 10 ms is pretty short
          // Ideally, we should figure out a proper way to fix this, possibly by
          // using @drop instead of @dragend, but I haven't been able to get that
          // working yet.
          setTimeout(() => {
            getManager().onDragLeave(event, target);
          }, 10);
        }}
        @dragover=${(event: DragEvent) => {
          getManager().onDragOver(event);
        }}
      >
        <slot></slot>
      </div>
    `;
  }

  private async handleDragEnd() {
    const dragged = getManager().getDragged();
    const hovered = getManager().getHovered();
    if (dragged === undefined || hovered === undefined) {
      return;
    }
    if (dragged.type === 'chip') {
      const type = hovered.type;
      const {dragAndDropCommands} = dragged.data.chip;
      if (!dragAndDropCommands) {
        return;
      }
      if (type === 'commit' || type === 'chip') {
        let destinationCommit: CommitNode;
        if (hovered.type === 'commit') {
          destinationCommit = hovered.data;
        } else {
          destinationCommit = hovered.data.node;
        }
        if (destinationCommit === dragged.data.node) {
          return;
        }
        await this.extensionApi.$executeCommand(
          this.state.repoName,
          dragAndDropCommands.move.command,
          [
            ...(dragAndDropCommands.move.arguments ?? []),
            destinationCommit.hash,
          ],
        );
      } else if (type === 'garbageSection') {
        await this.extensionApi.$executeCommand(
          this.state.repoName,
          dragAndDropCommands.abandon.command,
          dragAndDropCommands.abandon.arguments,
        );
      }
    } else if (dragged.type === 'commit') {
      const dragAndDropCommands = this.state.options.dragAndDropCommands;
      if (!dragAndDropCommands) {
        return;
      }

      const sourceCommits = this.state.multiSelectionMode
        ? this.state.commits
            .filter((commit) => commit.isMultiSelected)
            .map((commit) => commit.hash)
        : [dragged.data.hash];

      const type = hovered.type;
      switch (type) {
        case 'commit':
        case 'chip': {
          const hoveredCommit =
            hovered.type === 'commit' ? hovered.data : hovered.data.node;

          await this.extensionApi.$executeCommand(
            this.state.repoName,
            dragAndDropCommands.rebase.command,
            [
              ...(dragAndDropCommands.rebase.arguments ?? []),
              sourceCommits,
              hoveredCommit.hash,
            ],
          );
          return;
        }
        case 'garbageSection':
          // Don't wait for the command to complete. Return as soon as possible,
          // so users can start the next drag and drop operation.
          void this.extensionApi.$executeCommand(
            this.state.repoName,
            dragAndDropCommands.abandon.command,
            [...(dragAndDropCommands.abandon.arguments ?? []), sourceCommits],
          );
          return;
        case 'insert': {
          if (
            hovered.data.from === undefined &&
            hovered.data.to === undefined
          ) {
            throw new Error(
              'Programming error: one of from or to should be defined.',
            );
          }
          if (isNoopInsert(dragged, hovered)) {
            return;
          }

          let insertBefore: string[];
          if (hovered.data.to) {
            insertBefore = [hovered.data.to.hash];
          } else {
            insertBefore = hovered.data.from.children.map(
              (child) => child.node.hash,
            );
          }

          let insertAfter: string[];
          if (hovered.data.from) {
            insertAfter = [hovered.data.from.hash];
          } else {
            insertAfter = hovered.data.to.parents.map((parent) => parent.hash);
          }

          await this.extensionApi.$executeCommand(
            this.state.repoName,
            dragAndDropCommands.insert.command,
            [
              ...(dragAndDropCommands.insert.arguments ?? []),
              {
                target: sourceCommits,
                insertBefore,
                insertAfter,
              },
            ],
          );
          break;
        }
        default:
          checkExhaustive(type);
      }
    }
  }

  private getBlankImage() {
    const blankImage = document.createElement('div');
    blankImage.innerText = 'ghost';
    blankImage.style.transform = 'translate(-10000px, -10000px)';
    blankImage.style.position = 'absolute';
    blankImage.style.visibility = 'hidden';
    return blankImage;
  }

  private getBookmarkDragImage(chip: SplitChip) {
    const bookmark = new JjCommitRowSplitChip();
    bookmark.state = this.state;
    bookmark.extensionApi = this.extensionApi;
    bookmark.chip = chip;
    bookmark.opacity = '0.7';
    return bookmark;
  }

  private setDragImage(event: DragEvent, dragImage: HTMLElement) {
    document.body.appendChild(dragImage);
    // Set the drag image (0,0 offsets it to the cursor top-left)
    event.dataTransfer?.setDragImage(dragImage, 0, 0);
    // Remove the element immediately after setDragImage is called.
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }
}

/**
 * Returns whether the given node is draggable.
 */
export function isDraggable(target: Target, state: CommitGraphState) {
  if (!state.options.dragAndDropCommands) {
    return false;
  }
  if (target.type === 'garbageSection' || target.type === 'insert') {
    return false;
  }
  if (target.type === 'chip') {
    return Boolean(target.data.chip.dragAndDropCommands);
  }

  const commit = target.data;
  if (state.multiSelectionMode && !commit.isMultiSelected) {
    return false;
  }
  return !commit.isImmutable;
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-drag-and-drop-publisher': JjDragAndDropPublisher;
  }
}
