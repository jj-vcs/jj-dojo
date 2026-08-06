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

import {age} from '../utils/time';
import type {CommitNode} from '../api/types';

/** one minute in milliseconds */
export const ONE_MINUTE_MS = 60 * 1e3;

@customElement('jj-time-ago-text')
class JjTimeAgoText extends LitElement {
  static override styles = css`
    :host {
      user-select: none;
    }
  `;

  @property({attribute: false}) text?: string;
  @property({attribute: false}) node!: CommitNode;

  // The id of the timeout event that triggers re-rendering the commit graph.
  private renderAgain?: ReturnType<typeof setTimeout>;

  override connectedCallback() {
    super.connectedCallback();
    this.renderAgain = setInterval(async () => {
      if (this.node === undefined) {
        return;
      }
      this.requestUpdate();
    }, ONE_MINUTE_MS);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.renderAgain);
  }

  override render() {
    return html`${this.text ?? 'Submitted'} ${age(this.node.updateTime / 1000)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-time-ago-text': JjTimeAgoText;
  }
}
