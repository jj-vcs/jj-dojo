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
import type {CommitGraphState, CommitNode, TileGroup} from '../api/types';
import {MergeTileType} from './merge_tile';

import './glyph_tile';
import './merge_tile';

@customElement('jj-tile-group')
class JjTileGroup extends LitElement {
  static override styles = css`
    .tile-group {
      display: flex;
      flex-direction: column;
      height: 100%;
      /** Position relative to allow the rebase hint to be absolute. */
      position: relative;
    }
  `;

  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) tileGroup!: TileGroup;
  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) x!: number;

  override render() {
    const shouldDrawGlyph = this.x === this.node.x;
    return html` <div class="tile-group">
      <jj-merge-tile
        .state=${this.state}
        .extensionApi=${this.extensionApi}
        .tile=${this.tileGroup.top}
        .node=${this.node}
        .shouldDrawGlyph=${shouldDrawGlyph}
        .type=${MergeTileType.TOP}
      ></jj-merge-tile>
      <jj-glyph-tile
        .state=${this.state}
        .extensionApi=${this.extensionApi}
        .node=${this.node}
        .glyphTile=${this.tileGroup.glyph}
        .shouldDrawGlyph=${shouldDrawGlyph}
        .x=${this.x}
      >
      </jj-glyph-tile>
      <jj-merge-tile
        .state=${this.state}
        .extensionApi=${this.extensionApi}
        .tile=${this.tileGroup.bottom}
        .node=${this.node}
        .shouldDrawGlyph=${shouldDrawGlyph}
        .type=${MergeTileType.BOTTOM}
      ></jj-merge-tile>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-tile-group': JjTileGroup;
  }
}
