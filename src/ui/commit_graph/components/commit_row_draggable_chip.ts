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

import {html} from 'lit';
import {customElement, property} from 'lit/decorators';
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState, CommitNode, SplitChip} from '../api/types';
import {createChipTarget} from './drag_and_drop_state';
import {JjDragAndDropAllTargetsSubscriber} from './drag_and_drop_subscriber';

import './commit_row_chip';
import './drag_and_drop_publisher';

@customElement('jj-commit-row-draggable-split-chip')
export class JjCommitRowDraggableSplitChip extends JjDragAndDropAllTargetsSubscriber {
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) chip!: SplitChip;

  override render() {
    const isDragSource =
      this.dragged?.type === 'chip' && this.dragged.data.chip === this.chip;
    return html`
      <jj-drag-and-drop-publisher
        .publishedTarget=${createChipTarget(this.node, this.chip)}
        .extensionApi=${this.extensionApi}
        .state=${this.state}
      >
        <jj-commit-row-split-chip
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .chip=${this.chip}
          .style=${`opacity: ${isDragSource ? 0.3 : 1}`}
          draggable="true"
        >
        </jj-commit-row-split-chip>
      </jj-drag-and-drop-publisher>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row-draggable-split-chip': JjCommitRowDraggableSplitChip;
  }
}
