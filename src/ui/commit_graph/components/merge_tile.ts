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
import {
  RenderMode,
  type CommitGraphState,
  type CommitNode,
  type Tile,
} from '../api/types';
import {MERGE_TILE_HEIGHT, TILE_WIDTH, COMMIT_ROW_HEIGHT} from './constants';
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
    const height =
      this.state.options.renderMode === RenderMode.TWO_LINE
        ? MERGE_TILE_HEIGHT + COMMIT_ROW_HEIGHT / 2
        : MERGE_TILE_HEIGHT;
    return html`
      <jj-drag-and-drop-publisher
        .publishedTarget=${createInsertTarget(this.tile.insertAction)}
        .state=${this.state}
        .extensionApi=${this.extensionApi}
        class="drag-and-drop-publisher"
        style="height: ${height}px"
      >
        <div draggable="${false}" class="svg-container">
          ${this.renderLines(height)}
        </div>
      </jj-drag-and-drop-publisher>
    `;
  }

  private renderLines(height: number) {
    return this.tile.lines.map((line) =>
      getSvgLine(line, this.dragged, this.hovered, {
        tileWidth: TILE_WIDTH,
        tileHeight: height,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-merge-tile': JjMergeTile;
  }
}
