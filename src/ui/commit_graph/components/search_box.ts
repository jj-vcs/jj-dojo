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
import {customElement, state, query} from 'lit/decorators';
import {classMap} from 'lit/directives/class-map';
import {VscodeTextfield} from '@vscode-elements/elements';
import {highlight} from './search_highlighter';

import './codicon';

@customElement('jj-search-box')
class JjSearchBox extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      right: 0;
      z-index: 100;

      max-width: calc(100% - 10px);
    }
    .wrapper {
      display: flex;
      align-items: center;
      height: 33px;
      border-radius: var(--vscode-cornerRadius-large);
      box-shadow: var(--vscode-shadow-lg);
      background-color: var(--vscode-editorWidget-background);
      color: var(--vscode-editorWidget-foreground);
      border: 1px solid var(--vscode-editorWidget-border);
    }
    .displayNone {
      display: none;
    }

    vscode-textfield {
      max-width: 200px;
      margin-left: 5px;
      margin-right: 1px;
    }

    .result-count {
      min-width: 65px;
      margin-left: 3px;
    }

    .error-foreground {
      color: var(--vscode-errorForeground);
    }
  `;

  @state() isVisible = false;
  @state() ranges: Range[] = [];
  @state() index: number = 0;
  @state() query: string = '';

  @query('#search-box')
  searchBox!: VscodeTextfield;

  private keydownListener = async (event: KeyboardEvent) => {
    // Check if Cmd (metaKey) or Ctrl (ctrlKey) is pressed along with 'f'
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
      // Prevents the vscode/browser native find-in-page search bar.
      event.stopPropagation();
      event.preventDefault();

      if (this.isVisible) {
        // If user pressed cmd/ctrl f while the search box is already open,
        // select all the text.
        this.searchBox.wrappedElement.select();
      }

      this.isVisible = true;
      // Wait for an update cycle before running `.focus()`. Otherwise `.focus()`
      // would be run on an obsolete element.
      await this.updateComplete;
      this.searchBox.focus();
    } else if (event.key === 'Enter') {
      if (!this.isVisible) {
        return;
      }
      if (event.shiftKey) {
        this.previousResult();
      } else {
        this.nextResult();
      }
      event.stopPropagation();
    } else if (event.key === 'Escape') {
      if (!this.isVisible) {
        return;
      }
      this.closeSearchBox();
      // Eat the escape keypress. In the commit graph, we'll want the escape key to
      // close the search box first, then unselect all multi-selected commits.
      // If the escape key already closes the search box, then don't unselect the
      // commits.
      event.stopPropagation();
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.keydownListener);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.keydownListener);
  }

  override render() {
    if (!this.isVisible) {
      return html``;
    }
    return html` <div
      class=${classMap({
        wrapper: true,
      })}
    >
      <vscode-textfield
        id="search-box"
        placeholder="Find..."
        @input=${(event: Event) => {
          this.onInputChange((event.target as HTMLInputElement).value);
          if (this.ranges.length > 0) {
            scrollRangeIntoView(this.ranges[0]);
          }
        }}
      >
        <vscode-icon
          slot="content-before"
          name="search"
          title="search"
        ></vscode-icon>
      </vscode-textfield>
      ${this.renderResultCount()}
      <vscode-icon
        name="arrow-up"
        action-icon
        @click=${() => {
          this.previousResult();
        }}
      ></vscode-icon>
      <vscode-icon
        name="arrow-down"
        action-icon
        @click=${() => {
          this.nextResult();
        }}
      ></vscode-icon>
      <vscode-icon
        name="close"
        action-icon
        @click=${() => this.closeSearchBox()}
      ></vscode-icon>
    </div>`;
  }

  private onInputChange(query: string) {
    this.ranges = highlight(query);
    this.index = 0;
    this.query = query;
  }

  private previousResult() {
    this.index = (this.index - 1 + this.ranges.length) % this.ranges.length;
    scrollRangeIntoView(this.ranges[this.index]);
  }

  private nextResult() {
    this.index = (this.index + 1) % this.ranges.length;
    scrollRangeIntoView(this.ranges[this.index]);
  }

  private renderResultCount() {
    const classes: Record<string, boolean> = {
      'result-count': true,
    };
    let text;
    if (this.ranges.length === 0) {
      text = 'No results';
      classes['error-foreground'] = this.query.length > 0;
    } else {
      text = `${this.index + 1} of ${this.ranges.length}`;
    }
    return html`<span class=${classMap(classes)}>${text}</span>`;
  }

  private closeSearchBox() {
    this.onInputChange('');
    this.isVisible = false;
  }
}

function scrollRangeIntoView(range: Range) {
  CSS.highlights.set('search-current-match', new Highlight(range));

  // Get the bounding rectangle of the selected range
  const rects = range.getClientRects();

  if (rects.length > 0) {
    // Use the first bounding box of the range
    const rect = rects[0];

    // Calculate the absolute position on the page
    const absoluteTop = rect.top + window.scrollY;

    window.scrollTo({
      top: absoluteTop,
      behavior: 'instant',
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-search-box': JjSearchBox;
  }
}
