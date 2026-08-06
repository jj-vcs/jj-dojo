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
import type {CommitGraphState} from '../api/types';
import {TOP_BAR_HEIGHT} from './constants';
import {GARBAGE_SECTION_TARGET} from './drag_and_drop_state';
import {JjDragAndDropSubscriber} from './drag_and_drop_subscriber';

import './codicon';

@customElement('jj-garbage-section')
class JjGarbageSection extends JjDragAndDropSubscriber {
  static override get styles() {
    return css`
      :host {
        display: flex;
        /** -1 to create a small gap between the top bar and the commit graph. */
        height: ${TOP_BAR_HEIGHT - 1}px;
        margin: auto 5px;
      }
      .jj-drag-and-drop-publisher {
        width: 100%;
        border-width: 2px;
        border-style: dashed;
        border-radius: 4px;
        color: var(--jj-garbageSection-color);
        background-color: var(--jj-garbageSection-backgroundColor);
        border-color: var(--jj-garbageSection-borderColor);
      }
      .jj-drag-and-drop-publisher[isHovered] {
        color: var(--jj-garbageSection-hoverColor);
        background-color: var(--jj-garbageSection-hoverBackgroundColor);
        border-color: var(--jj-garbageSection-hoverBorderColor);
      }
      .container {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      /**
       * Disable pointer events for children of the container to prevent them
       * from triggering drag and drop events.
       */
      .container > * {
        pointer-events: none;
      }
    `;
  }

  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;

  override render() {
    return html`
      <jj-drag-and-drop-publisher
        .publishedTarget=${GARBAGE_SECTION_TARGET}
        .extensionApi=${this.extensionApi}
        .state=${this.state}
        class="jj-drag-and-drop-publisher"
        ?isHovered=${this.isDragDestination}
      >
        <div class="container">
          <jj-codicon
            .codicon=${'codicon-trash'}
            .color=${this.isDragDestination
              ? 'var(--jj-garbageSection-hoverColor)'
              : 'var(--jj-garbageSection-color)'}
          ></jj-codicon>
          ${this.getHintText()}
        </div>
      </jj-drag-and-drop-publisher>
    `;
  }

  private getHintText() {
    const multiSelectedCount = this.state.commits.filter(
      (commit) => commit.isMultiSelected,
    ).length;
    if (multiSelectedCount > 1) {
      if (this.isDragDestination) {
        return `Abandon ${multiSelectedCount} commits`;
      } else {
        return `Drop here to abandon ${multiSelectedCount} commits`;
      }
    } else {
      if (this.isDragDestination) {
        return 'Abandon';
      } else {
        return 'Drop here to abandon';
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-garbage-section': JjGarbageSection;
  }
}
