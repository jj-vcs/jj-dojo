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
import type {CommitGraphState, CommitNode} from '../api/types';
import {JjDragAndDropAllTargetsSubscriber} from './drag_and_drop_subscriber';
import {COMMIT_ROW_HEIGHT} from './constants';

import './commit_row_chip';
import './commit_row_draggable_chip';

@customElement('jj-commit-row-chip-group')
class JjCommitRowChipGroup extends JjDragAndDropAllTargetsSubscriber {
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
    ${this.node.chips.map(
      (chip) =>
        html`<jj-commit-row-draggable-split-chip
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .node=${this.node}
          .chip=${chip}
        >
        </jj-commit-row-draggable-split-chip>`,
    )}`;
  }

  private renderDraggedBookmark() {
    if (this.dragged?.type !== 'chip' || this.dragged.data.node === this.node) {
      return html``;
    }
    let hoveredNode: CommitNode;
    if (this.hovered?.type === 'commit') {
      hoveredNode = this.hovered.data;
    } else if (this.hovered?.type === 'chip') {
      hoveredNode = this.hovered.data.node;
    } else {
      return html``;
    }
    if (hoveredNode === this.node) {
      return html`
        <jj-commit-row-split-chip
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .chip=${this.dragged.data.chip}
        >
        </jj-commit-row-split-chip>
      `;
    }
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row-chip-group': JjCommitRowChipGroup;
  }
}
