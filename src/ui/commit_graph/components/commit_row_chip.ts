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

import {LitElement, css, html} from 'lit';
import {customElement, property, state} from 'lit/decorators';
import {ifDefined} from 'lit/directives/if-defined';
import type {ExtensionShape} from '../api/extension_shape';
import type {Chip, CommitGraphState, SplitChip} from '../api/types';
import {openContextMenu} from '../components/context_menu_provider';
import {isMac} from './user_agent';

import './codicon';

/**
 * A component that renders a single bookmark chip.
 */
@customElement('jj-commit-row-split-chip')
export class JjCommitRowSplitChip extends LitElement {
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) chip!: SplitChip;
  @property({attribute: false}) opacity!: string;

  static override styles = css`
    :host {
      display: flex;
    }
  `;

  override render() {
    if (this.chip.right) {
      return html`
        <jj-commit-row-split-chip-internal
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .chip=${this.chip}
          style="opacity: ${this.opacity};"
          @contextmenu=${this.openContextMenu}
        >
        </jj-commit-row-split-chip-internal>
      `;
    }
    return html`
      <jj-commit-row-chip-internal
        .state=${this.state}
        .extensionApi=${this.extensionApi}
        .chip=${this.chip.left}
        style="opacity: ${this.opacity};"
        @contextmenu=${this.openContextMenu}
      >
      </jj-commit-row-chip-internal>
    `;
  }

  private readonly openContextMenu = (event: MouseEvent) => {
    if (this.chip.vscodeContext === undefined) {
      return;
    }
    // Stop the event from bubbling up and triggering the context menu for the
    // commit row to open.
    event.stopPropagation();
    // Prevent the browser default (i.e. non-vscode) context menu from opening.
    event.preventDefault();
    openContextMenu({
      dataVscodeContext: JSON.stringify({
        ...this.chip.vscodeContext,
        preventDefaultContextMenuItems: true,
      }),
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };
}

@customElement('jj-commit-row-split-chip-internal')
class JjCommitRowSplitChipInternal extends LitElement {
  static override styles = css`
    .wrapper {
      display: flex;
      flex-direction: row;
      border-width: 1px;
      border-style: solid;
      border-radius: 8px;
      overflow: hidden;
    }
  `;

  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) chip!: SplitChip;

  override render() {
    return html`
      <div
        class="wrapper"
        style="border-color: ${this.chip.right?.borderColor ?? 'transparent'};"
      >
        <jj-commit-row-chip-content
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .chip=${this.chip.left}
        >
        </jj-commit-row-chip-content>
        ${this.chip.right
          ? html`<jj-commit-row-chip-content
              .state=${this.state}
              .extensionApi=${this.extensionApi}
              .chip=${this.chip.right.chip}
            >
            </jj-commit-row-chip-content>`
          : html``}
      </div>
    `;
  }
}

@customElement('jj-commit-row-chip-internal')
class JjCommitRowChipInternal extends LitElement {
  static override styles = css`
    .wrapper {
      border-width: 1px;
      border-style: solid;
      border-radius: 8px;
      overflow: hidden;
      padding: 0 2px;
    }
  `;

  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) chip!: Chip;

  override render() {
    return html`<div
      class="wrapper"
      style="
        border-color: ${this.chip.color.border};
        background-color: ${this.chip.color.background};
      "
    >
      <jj-commit-row-chip-content
        .state=${this.state}
        .extensionApi=${this.extensionApi}
        .chip=${{
          ...this.chip,
          color: {
            ...this.chip.color,
            // Don't set the background color again, otherwise colors with
            // transparency will overlap and show a darker color.
            background: 'transparent',
          },
        }}
      >
      </jj-commit-row-chip-content>
    </div>`;
  }
}

@customElement('jj-commit-row-chip-content')
class JjCommitRowChipContent extends LitElement {
  static override styles = css`
    .chip {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 18px;
      line-height: 17px;
      padding: 0 4px;
      gap: 2px;

      flex-grow: 1;

      /** Don't allow selecting text in the chip. */
      user-select: none;
    }
    .chip[underlineOnHover]:hover {
      text-decoration: underline;
    }
    a {
      text-decoration: none;
      display: flex;
    }
    span[cursorPointer] {
      cursor: pointer;
    }
  `;

  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) chip!: Chip;

  @state() isHovered = false;

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('mouseenter', () => (this.isHovered = true));
    this.addEventListener('mouseleave', () => (this.isHovered = false));
  }

  override render() {
    const command = this.chip.command;
    if (command !== undefined) {
      return html`<span
        .style="min-width: ${this.chip.minWidth ?? 0}px;"
        ?cursorPointer=${Boolean(this.chip.link || this.chip.command)}
        @click=${(event: MouseEvent) => {
          // Prevent parent elements from considering clicking bookmark
          // chips as multi-select events.
          event.stopPropagation();
          void this.extensionApi.$executeCommand(
            this.state.repoName,
            command.command,
            command.arguments,
          );
        }}
      >
        ${this.renderChip()}
      </span>`;
    }
    if (this.chip.link !== undefined) {
      return html`<a
        .style="min-width: ${this.chip.minWidth ?? 0}px;"
        draggable="false"
        href="${this.chip.link ?? ''}"
        @auxclick=${(event: MouseEvent) => {
          // When event.button === 1, it's a mouse middle click.
          if (event.button === 1) {
            // Convert it to normal ctrl+click so that it opens the link in a
            // new tab.
            event.currentTarget?.dispatchEvent(
              new MouseEvent('click', {
                button: 0,
                metaKey: true,
                ctrlKey: true,
                bubbles: true,
                cancelable: true,
              }),
            );
            event.stopPropagation();
          }
        }}
        @click=${(event: MouseEvent) => {
          const isMacOs = isMac();
          if ((isMacOs && event.metaKey) || (!isMacOs && event.ctrlKey)) {
            // Prevent parent elements from considering clicking bookmark
            // chips as multi-select events.
            event.stopPropagation();
            // If we were to do event.preventDefault() here, the ctrl+click
            // (or meta+click on Mac) would switch focus to the newly opened
            // tab. So let's stop propagation to keep the original behavior.
          } else {
            // Normally we'd want to use `event.stopPropagation()` here just like
            // above to prevent parent elements from considering the click as
            // a multi-select event. However, VS Code has certain limitations
            // that prevent us from doing that. In order to ensure the links
            // from webviews are safe, VS Code intercepts click events from the
            // webview, and has its own logic to open links. If we use
            // `event.stopPropagation()` here, this causes VS Code to be unable
            // to intercept the click event. As a result, the browser default
            // behavior kicks in and opens the link inside the webview. This
            // causes the browser Content Security Policy to kick in, and the
            // webview is destroyed with an error message saying:
            //      Refused to frame 'https://<the-href-link>' because it violates the following
            //      Content Security Policy directive: "frame-src 'self' blob: https://*.scf.usercontent.goog/".
            // To work around this, we don't call `event.stopPropagation()`,
            // but instead call `event.preventDefault()`. In the parent element,
            // we check whether event.defaultPrevented is true, and if so, we
            // disregard the click event.
            event.preventDefault();
          }
        }}
      >
        ${this.renderChip()}
      </a>`;
    }
    return this.renderChip();
  }

  private renderChip() {
    return html`<span
      class="chip"
      ?underlineOnHover=${this.chip.underlineOnHover ?? false}
      title=${ifDefined(this.chip.tooltip)}
      style="
      background-color: ${this.chip.color.background};
      color: ${this.chip.color.foreground};
      white-space: nowrap;
    "
    >
      ${this.renderCodicon(this.chip.codiconBefore, this.chip.color.foreground)}
      ${this.isHovered && this.chip.textOnHover
        ? this.chip.textOnHover
        : this.chip.text}
      ${this.renderCodicon(this.chip.codiconAfter, this.chip.color.foreground)}
    </span>`;
  }

  private renderCodicon(codicon: string | undefined, color: string) {
    if (codicon === undefined) {
      return html``;
    }
    return html` <jj-codicon .codicon=${codicon} .color=${color}></jj-codicon>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row-chip-internal': JjCommitRowChipInternal;
    'jj-commit-row-split-chip-internal': JjCommitRowSplitChipInternal;
    'jj-commit-row-chip-content': JjCommitRowChipContent;
    'jj-commit-row-split-chip': JjCommitRowSplitChip;
  }
}
