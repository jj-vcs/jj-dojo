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
import {customElement, property} from 'lit/decorators';
import {classMap} from 'lit/directives/class-map';
import {safeHTML} from './safe_html';
import type {ExtensionShape} from '../api/extension_shape';
import type {Callout} from '../api/types';
import {CalloutType} from '../api/types';

@customElement('jj-callout')
class JjCallout extends LitElement {
  // The callout styles are based on go/cider-developing-webviews#callouts-and-warnings
  static override styles = css`
    a,
    .dismiss-link {
      color: var(
        --vscode-inputValidation-infoForeground,
        var(--vscode-textLink-foreground)
      );
    }
    div.callout {
      padding: 8px;
      border: 1px solid var(--vscode-editorWidget-border);
      margin: 5px;
    }
    div.callout-error {
      border-color: var(--vscode-inputValidation-errorBorder);
      background-color: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
    }
    div.callout-warning {
      border-color: var(--vscode-inputValidation-warningBorder);
      background-color: var(--vscode-inputValidation-warningBackground);
      color: var(--vscode-inputValidation-warningForeground);
    }
    div.callout-info {
      border-color: var(--vscode-inputValidation-infoBorder);
      background-color: var(--vscode-inputValidation-infoBackground);
      color: var(--vscode-inputValidation-infoForeground);
    }
    h1 {
      font-weight: bold;
      font-size: calc(var(--vscode-font-size) * 1.1);
    }
    ul {
      margin: 0;
    }
    .dismiss-link {
      margin-top: 10px;
    }
    .dismiss-link span:hover {
      cursor: pointer;
      text-decoration: underline;
    }
  `;

  @property({attribute: false}) callout?: Callout;
  @property({attribute: false}) extensionApi?: ExtensionShape;

  override render() {
    if (this.callout === undefined) {
      return html``;
    }
    const classes = classMap({
      callout: true,
      'callout-error': this.callout.type === CalloutType.ERROR,
      'callout-warning': this.callout.type === CalloutType.WARNING,
      'callout-info': this.callout.type === CalloutType.INFO,
    });
    return html`<div class=${classes}>
      ${safeHTML(this.callout.message)}${this.renderDismissButton()}
    </div>`;
  }

  private dismissCallout() {
    void this.extensionApi?.$dismissCallout(this.callout!.dismissId!);
    this.callout = undefined;
    this.requestUpdate();
  }

  private renderDismissButton() {
    if (!this.callout?.dismissId) {
      return html``;
    }
    if (this.callout.dismissStyle === 'link') {
      return html`<div class="dismiss-link">
        <span
          @click=${() => {
            this.dismissCallout();
          }}
          >Don't show this again
        </span>
      </div>`;
    }
    return html`<vscode-button
      @click=${() => {
        this.dismissCallout();
      }}
      >Dismiss</vscode-button
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-callout': JjCallout;
  }
}
