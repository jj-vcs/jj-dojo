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
import type {CommitGraphState, CommitNode, Tile} from '../api/types';
import {MERGE_TILE_HEIGHT, TILE_WIDTH} from './constants';
import {createInsertTarget} from './drag_and_drop_state';
import {JjDragAndDropAllTargetsSubscriber} from './drag_and_drop_subscriber';
import {getSvgLine} from './lines';

import './drag_and_drop_publisher';
import './insert_hint';

/**
 * The type of the merge tile.
 */
export enum MergeTileType {
  TOP,
  BOTTOM,
}

@customElement('jj-merge-tile')
class JjMergeTile extends JjDragAndDropAllTargetsSubscriber {
  static override styles = css`
    :host {
      display: flex;
      width: ${TILE_WIDTH}px;
      height: ${MERGE_TILE_HEIGHT}px;
      position: relative;
    }
    .svg-container {
      display: flex;
      align-items: flex-start;
      width: 100%;
      height: 100%;
    }
    svg {
      position: absolute;
      overflow: visible;
      width: 100%;
      height: 100%;
    }
  `;

  @property({attribute: false}) tile!: Tile;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) shouldDrawGlyph!: boolean;
  @property({attribute: false}) type!: MergeTileType;

  override render() {
    return html`
      <jj-drag-and-drop-publisher
        .publishedTarget=${createInsertTarget(this.tile.insertAction)}
        .state=${this.state}
        .extensionApi=${this.extensionApi}
        class="drag-and-drop-publisher"
      >
        <div draggable="${false}" class="svg-container">
          ${this.renderLines()}
        </div>
      </jj-drag-and-drop-publisher>
    `;
  }

  private renderLines() {
    return this.tile.lines.map((line) =>
      getSvgLine(line, this.dragged, this.hovered, {
        tileWidth: TILE_WIDTH,
        tileHeight: MERGE_TILE_HEIGHT,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-merge-tile': JjMergeTile;
  }
}
