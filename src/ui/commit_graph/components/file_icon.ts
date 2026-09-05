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

import {LitElement, PropertyValues, css, html} from 'lit';
import {customElement, property} from 'lit/decorators';
import {styleMap} from 'lit/directives/style-map';
import type {FileEntry} from '../api/types';

/**
 * Returns a Unicode glyph string from a font character hex string (e.g., '\E901' -> '\uE901').
 */
function getGlyphCharacter(fontCharacter?: string): string {
  if (!fontCharacter) return '';
  if (fontCharacter.startsWith('\\')) {
    const code = parseInt(fontCharacter.slice(1), 16);
    return isNaN(code) ? fontCharacter : String.fromCodePoint(code);
  }
  return fontCharacter;
}

/**
 * Renders an icon for a file entry using either an image URI or a font glyph.
 */
@customElement('jj-file-icon')
export class JjFileIcon extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      line-height: 1;
      flex-shrink: 0;
      font-size: 150%;
    }
    .icon {
      width: 100%;
      height: 100%;
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;

  @property({attribute: false})
  file?: FileEntry;

  override firstUpdated() {
    this.loadFont();
  }

  override updated(changedProperties: PropertyValues) {
    if (changedProperties.has('file')) {
      this.loadFont();
    }
  }

  private loadFont() {
    if (this.file?.fontFamily && this.file?.fontUri) {
      document.fonts.clear();
      try {
        const font = new FontFace(
          this.file.fontFamily,
          `url('${this.file.fontUri}')`,
        );
        document.fonts.add(font);
        font.load().catch(() => {});
      } catch {
        // Ignore font loading errors
      }
    }
  }

  override render() {
    if (!this.file) {
      return html`<span class="icon"></span>`;
    }

    if (this.file.iconUri) {
      return html`<span
        class="icon"
        style=${styleMap({backgroundImage: `url('${this.file.iconUri}')`})}
      ></span>`;
    }

    if (this.file.fontCharacter) {
      const glyph = getGlyphCharacter(this.file.fontCharacter);
      const styles: Record<string, string> = {};
      if (this.file.fontFamily) {
        styles['fontFamily'] = this.file.fontFamily;
      }
      if (this.file.fontColor) {
        styles['color'] = this.file.fontColor;
      }
      return html`<span class="icon" style=${styleMap(styles)}>${glyph}</span>`;
    }

    return html`<span class="icon"></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-file-icon': JjFileIcon;
  }
}
