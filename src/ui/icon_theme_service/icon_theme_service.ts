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

import * as vscode from 'vscode';
import {IconTheme} from './icon_theme';

/** A duplicate of FileIcon in src/ui/commit_graph/api/types.ts to avoid a dependency on it */
export interface FileIcon {
  // One of iconUri or font should be set.
  readonly iconUri?: string;

  // Font specs if the theme uses font for icons.
  readonly font?: FileFont;
}

/** A duplicate of FileFont in src/ui/commit_graph/api/types.ts to avoid a dependency on it */
export interface FileFont {
  // URI to the font file (e.g. '.../seti.woff').
  readonly fontUri: string;

  // Font character / glyph code (e.g. '\E029') if the theme uses font icons.
  readonly fontCharacter: string;

  // Color for the font icon (e.g. '#519aba').
  readonly fontColor: string;

  // Font family name (e.g. 'seti').
  readonly fontFamily: string;
}

/**
 * Resolves active VS Code file icon themes and generates minimal CSS
 * for the requested files.
 */
export class IconThemeService {
  private cachedIconTheme?: {
    theme: IconTheme;
    fontUris: Record<string, string>;
    defaultFontId: string | undefined;
  };

  constructor(private readonly webview: vscode.Webview) {}

  getFileIcon(fileName: string): FileIcon {
    if (!this.cachedIconTheme) {
      return {};
    }
    const {theme, fontUris, defaultFontId} = this.cachedIconTheme;

    // Resolve icon for each requested file
    const iconId = theme.getIconId(fileName);
    const def = theme.getIconDefinition(iconId);
    if (def?.iconPath) {
      const iconUri = this.webview.asWebviewUri(
        vscode.Uri.joinPath(theme.themeDir, def.iconPath),
      );
      return {
        iconUri: iconUri.toString(),
      };
    }

    if (def?.fontCharacter) {
      const fontFamily = def.fontId || defaultFontId;
      const fontUri = fontFamily ? fontUris[fontFamily] : undefined;
      if (fontFamily && fontUri && def.fontColor) {
        return {
          font: {
            fontCharacter: def.fontCharacter,
            fontColor: def.fontColor,
            fontFamily,
            fontUri,
          },
        };
      }
    }
    return {};
  }

  async loadTheme() {
    // Return the cached theme if the id matches.
    const themeId =
      vscode.workspace.getConfiguration('workbench').get<string>('iconTheme') ||
      'vs-seti';
    if (this.cachedIconTheme?.theme.themeId === themeId) {
      return this.cachedIconTheme;
    }
    // Otherwise, load the new theme.
    const newTheme = await IconTheme.load(themeId);
    addExtensionUriToWebview(
      this.webview,
      newTheme.themeExtension.extensionUri,
    );

    // Resolve font URIs
    const fonts = newTheme.getFonts();
    const fontUris: Record<string, string> = {};
    for (const font of fonts) {
      if (!font.id || !font.src?.[0]?.path) continue;
      const fontUri = this.webview.asWebviewUri(
        vscode.Uri.joinPath(newTheme.themeDir, font.src[0].path),
      );
      fontUris[font.id] = fontUri.toString();
    }
    const defaultFontId = fonts[0]?.id;

    // Cache it
    this.cachedIconTheme = {
      theme: newTheme,
      fontUris,
      defaultFontId,
    };
    return this.cachedIconTheme;
  }
}

function addExtensionUriToWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
) {
  const extensionUriString = extensionUri.toString();
  const localResourceRoots = webview.options.localResourceRoots ?? [];
  for (const localResourceRoot of localResourceRoots) {
    if (localResourceRoot.toString() === extensionUriString) {
      // Already exists, no need to set it again.
      return;
    }
  }
  webview.options = {
    ...webview.options,
    localResourceRoots: [...localResourceRoots, extensionUri],
  };
}
