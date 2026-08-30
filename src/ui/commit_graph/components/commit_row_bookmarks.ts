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

import {css, html} from 'lit';
import {customElement, property} from 'lit/decorators';
import type {ExtensionShape} from '../api/extension_shape';
import type {
  CommitGraphState,
  CommitNode,
  SplitBookmarkChip,
} from '../api/types';
import {createBookmarkTarget} from './drag_and_drop_state';
import {JjDragAndDropAllTargetsSubscriber} from './drag_and_drop_subscriber';
import {COMMIT_ROW_HEIGHT} from './constants';

import './commit_row_chip';
import './drag_and_drop_publisher';

@customElement('jj-commit-row-bookmarks')
class JjCommitRowBookmarks extends JjDragAndDropAllTargetsSubscriber {
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) node!: CommitNode;

  static override styles = css`
    :host {
      display: flex;
      gap: 3px;
      align-items: center;
      height: ${COMMIT_ROW_HEIGHT}px;
    }
  `;

  override render() {
    return html`${this.renderDraggedBookmark()}
    ${this.node.bookmarkChips.map(
      (chip) =>
        html`<jj-commit-row-draggable-bookmark
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .node=${this.node}
          .chip=${chip}
        >
        </jj-commit-row-draggable-bookmark>`,
    )}`;
  }

  private renderDraggedBookmark() {
    if (
      this.dragged?.type !== 'bookmark' ||
      this.dragged.data.node === this.node
    ) {
      return html``;
    }
    let hoveredNode: CommitNode;
    if (this.hovered?.type === 'commit') {
      hoveredNode = this.hovered.data;
    } else if (this.hovered?.type === 'bookmark') {
      hoveredNode = this.hovered.data.node;
    } else {
      return html``;
    }
    if (hoveredNode === this.node) {
      return html`
        <jj-commit-row-bookmark
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .chip=${this.dragged.data.chip}
        >
        </jj-commit-row-bookmark>
      `;
    }
    return html``;
  }
}

@customElement('jj-commit-row-draggable-bookmark')
class JjCommitRowDraggableBookmark extends JjDragAndDropAllTargetsSubscriber {
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) chip!: SplitBookmarkChip;

  override render() {
    const isDragSource =
      this.dragged?.type === 'bookmark' && this.dragged.data.chip === this.chip;
    return html`
      <jj-drag-and-drop-publisher
        .publishedTarget=${createBookmarkTarget(this.node, this.chip)}
        .extensionApi=${this.extensionApi}
        .state=${this.state}
      >
        <jj-commit-row-bookmark
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .chip=${this.chip}
          .style=${`opacity: ${isDragSource ? 0.3 : 1}`}
          draggable="true"
        >
        </jj-commit-row-bookmark>
      </jj-drag-and-drop-publisher>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row-bookmarks': JjCommitRowBookmarks;
    'jj-commit-row-draggable-bookmark': JjCommitRowDraggableBookmark;
  }
}
