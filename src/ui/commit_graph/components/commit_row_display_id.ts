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

import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators';
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState, CommitNode} from '../api/types';
import {CommitGraphOptions} from '../api/types';
import {COMMIT_ROW_CHILD_ELEMENTS_GAP} from './constants';
import {isDraggable} from './drag_and_drop_publisher';
import {createCommitTarget} from './drag_and_drop_state';

/**
 * The display id of a commit row.
 */
@customElement('jj-commit-row-display-id')
export class JjCommitRowDisplayId extends LitElement {
  static override styles = css`
    .highlighted-text:not([isMultiSelected]) {
      color: var(--commit-row-highlighted-text);
    }
    .display-id {
      gap: 0px;
      padding-top: 5px;
      /**
       * In most font-families like sans-serif, characters have uneven
       * width. e.g. 'm' is much wider than 'l'. This makes the total width
       * of the display id uneven. To fix that, we use monospace font
       * which has equal width for all characters. This makes the display id
       * look more balanced.
       */
      font-family: monospace;
      /**
       * Taking the full height, so there are no gaps when dragging and
       * hovering over the display id.
       */
      height: 100%;
      /** Disable text selection. */
      user-select: none;
    }
    .display-id * {
      /** Avoids firing drag-leave events when hovering over child elements */
      pointer-events: none;
    }
    b {
      font-weight: 600;
    }
  `;

  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) nodes!: CommitNode[];
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;

  override render() {
    const width = JjCommitRowDisplayId.getWidth(this.nodes, this.state.options);
    const target = createCommitTarget(this.node);
    return html`
      <jj-drag-and-drop-publisher
        .publishedTarget=${target}
        .extensionApi=${this.extensionApi}
        .state=${this.state}
        class="drag-and-drop-publisher"
      >
        <div
          class="display-id"
          draggable="${isDraggable(target, this.state)}"
          style="width: ${width}px"
        >
          <b
            class="highlighted-text"
            ?isMultiSelected=${this.node.isMultiSelected}
            >${this.node.displayId.substring(
              0,
              this.node.highlightedDisplayIdLen,
            )}</b
          >${this.node.displayId.substring(this.node.highlightedDisplayIdLen)}
        </div>
      </jj-drag-and-drop-publisher>
    `;
  }

  static getWidth(nodes: CommitNode[], options: CommitGraphOptions): number {
    if (!options.showChangeId) {
      return 0;
    }
    let maxCharacters = 0;
    for (const node of nodes) {
      maxCharacters = Math.max(maxCharacters, node.displayId.length);
    }
    return (
      maxCharacters * 7.5 * (options.uiScaling ?? 1) +
      COMMIT_ROW_CHILD_ELEMENTS_GAP
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row-display-id': JjCommitRowDisplayId;
  }
}
