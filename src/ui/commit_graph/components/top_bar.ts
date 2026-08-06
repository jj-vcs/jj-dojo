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
import {customElement, property, state} from 'lit/decorators';
import {ifDefined} from 'lit/directives/if-defined';
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState} from '../api/types';
import {TOP_BAR_HEIGHT} from './constants';
import {openContextMenu} from './context_menu_provider';
import {GARBAGE_SECTION_TARGET} from './drag_and_drop_state';
import {JjDragAndDropAllTargetsSubscriber} from './drag_and_drop_subscriber';

import './garbage_section';

@customElement('jj-top-bar')
class JjTopBar extends JjDragAndDropAllTargetsSubscriber {
  static override styles = css`
    :host {
      display: block;
      position: sticky;
      z-index: 10;
      top: 0px;
      background-color: var(--vscode-sideBarStickyScroll-background);
      height: ${TOP_BAR_HEIGHT}px;
    }
    .container {
      background-color: var(--vscode-sideBar-background);
    }
    .container[scolled-down] {
      box-shadow: 0 4px 2px -2px var(--vscode-sideBarStickyScroll-shadow);
    }
    .top-bar-left {
      display: flex;
      gap: 5px;
      padding: 5px;
    }
    .codicon {
      color: var(--vscode-button-secondaryForeground);
      margin: 0;
      font-size: 20px;
    }

    vscode-button[isOnlyElement],
    vscode-button-group[isOnlyElement] {
      width: calc(100% - 5px);
    }
  `;

  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;

  // If there are many commits in the graph, a user can scroll down to see more
  // commits. When it's scrolled down, this variable should be set to true,
  // so the top bar can show a bottom box shadow to give a visual cue that the
  // top bar is sticky.
  @state() private scrolledDown = false;

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('scroll', this.scollEventListener);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('scroll', this.scollEventListener);
  }

  scollEventListener = () => {
    this.scrolledDown = window.scrollY > 0;
  };

  override render() {
    return html`
      <div
        class="container"
        ?scolled-down=${this.scrolledDown}
        @click=${() => {
          void this.extensionApi.$clearMultiSelection(this.state.repoName);
        }}
      >
        ${this.renderBody()}
      </div>
    `;
  }

  private renderBody() {
    if (this.dragged) {
      return this.renderGarbageSection();
    }
    return this.renderButtonGroup();
  }

  private renderButtonGroup() {
    const isOnlyElement = this.state.topBarButtons.length === 1;
    const buttons = this.state.topBarButtons.map(({left, right}) => {
      if (right === undefined) {
        return html` <vscode-button
          ?isOnlyElement=${isOnlyElement}
          ?disabled=${left.disabled}
          title="${ifDefined(left.command.tooltip)}"
          @click=${(event: MouseEvent) => {
            event.stopPropagation();
            void this.extensionApi.$executeCommand(
              this.state.repoName,
              left.command.command,
              left.command.arguments,
            );
          }}
          >${left.command.title}</vscode-button
        >`;
      }
      const dataVscodeContext = `{
        "origin": "${right.origin}",
        "primaryCommand": "${left.command.command}",
        "preventDefaultContextMenuItems": true
      }`;
      return html`
        <vscode-button-group ?isOnlyElement=${isOnlyElement}>
          <vscode-button
            ?isOnlyElement=${isOnlyElement}
            ?disabled=${left.disabled}
            title="${ifDefined(left.command.tooltip)}"
            @click=${(event: MouseEvent) => {
              event.stopPropagation();
              void this.extensionApi.$executeCommand(
                this.state.repoName,
                left.command.command,
                left.command.arguments,
              );
            }}
            >${left.command.title}</vscode-button
          >
          <vscode-button
            ?disabled=${right.disabled ?? false}
            icon="chevron-down"
            @click=${(event: MouseEvent) => {
              event.stopPropagation();
              const target = (
                event.target as HTMLElement
              ).getBoundingClientRect();
              openContextMenu({
                dataVscodeContext,
                clientX: target.left,
                clientY: target.bottom,
              });
            }}
          ></vscode-button>
        </vscode-button-group>
      `;
    });
    return html`<div class="top-bar-left">${buttons}</div>`;
  }

  private renderGarbageSection() {
    return html`<jj-garbage-section
      .subscribedTarget=${GARBAGE_SECTION_TARGET}
      .extensionApi=${this.extensionApi}
      .state=${this.state}
    ></jj-garbage-section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-top-bar': JjTopBar;
  }
}
