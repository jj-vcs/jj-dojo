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
import {COMMIT_ROW_CHILD_ELEMENTS_GAP, TILE_WIDTH} from './constants';

import './tile_group';

/**
 * The left side of a commit row, which includes the commit graph lines and
 * the commit node.
 */
@customElement('jj-commit-row-left-side')
export class JjCommitRowLeftSide extends LitElement {
  static override styles = css`
    .commit-row-left-side {
      display: flex;
      flex-direction: row;
      height: 100%;
    }
  `;

  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;

  override render() {
    const node = this.node;
    const tiles = [];
    for (let x = 0; x < node.tileGroups.length; ++x) {
      tiles.push(
        html`<jj-tile-group
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .tileGroup=${node.tileGroups[x]}
          .node=${node}
          .x=${x}
        >
        </jj-tile-group>`,
      );
    }
    return html`<div class="commit-row-left-side">${tiles}</div> `;
  }

  static getWidth(node: CommitNode) {
    return TILE_WIDTH * node.occupiedColumns + COMMIT_ROW_CHILD_ELEMENTS_GAP;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row-left-side': JjCommitRowLeftSide;
  }
}
