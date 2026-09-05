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

export interface FileIcon {
  // Path or name of the file (e.g. 'file.ts', 'abc.txt', 'mypy.py').
  readonly filePath: string;

  // URI to the icon image (e.g. SVG or PNG) if the theme uses image icons.
  readonly iconUri?: string;

  // Font character / glyph code (e.g. '\E029') if the theme uses font icons.
  readonly fontCharacter?: string;

  // Color for the font icon (e.g. '#519aba').
  readonly fontColor?: string;

  // Font family name (e.g. 'seti').
  readonly fontFamily?: string;

  // URI to the font file (e.g. '.../seti.woff').
  readonly fontUri?: string;
}

/**
 * Resolves active VS Code file icon themes and generates minimal CSS
 * for the requested files.
 */
export class IconThemeService {
  private cachedIconTheme?: IconTheme;

  constructor(private readonly webview: vscode.Webview) {}

  async getFileIcons(fileNames: string[]): Promise<FileIcon[]> {
    const iconTheme = await this.loadTheme();

    // Resolve font URIs
    const fonts = iconTheme.getFonts();
    const fontUris: Record<string, string> = {};
    for (const font of fonts) {
      if (!font.id || !font.src?.[0]?.path) continue;
      const fontUri = this.webview.asWebviewUri(
        vscode.Uri.joinPath(iconTheme.themeDir, font.src[0].path),
      );
      fontUris[font.id] = fontUri.toString();
    }
    const defaultFontId = fonts[0]?.id;

    // Resolve icon for each requested file
    const fileIcons: FileIcon[] = fileNames.map((name) => {
      const iconId = iconTheme.getIconId(name);
      const def = iconTheme.getIconDefinition(iconId);
      if (def?.iconPath) {
        const iconUri = this.webview.asWebviewUri(
          vscode.Uri.joinPath(iconTheme.themeDir, def.iconPath),
        );
        return {
          filePath: name,
          iconUri: iconUri.toString(),
        };
      } else if (def?.fontCharacter) {
        const fontFamily = def.fontId || defaultFontId;
        const fontUri = fontFamily ? fontUris[fontFamily] : undefined;
        return {
          filePath: name,
          fontCharacter: def.fontCharacter,
          fontColor: def.fontColor,
          fontFamily,
          fontUri,
        };
      }
      return {
        filePath: name,
      };
    });

    return fileIcons;
  }

  private async loadTheme(): Promise<IconTheme> {
    // Return the cached theme if the id matches.
    const themeId =
      vscode.workspace.getConfiguration('workbench').get<string>('iconTheme') ||
      'vs-seti';
    if (this.cachedIconTheme?.themeId === themeId) {
      return this.cachedIconTheme;
    }
    // Otherwise, load the new theme.
    this.cachedIconTheme = await IconTheme.load(themeId);
    addExtensionUriToWebview(
      this.webview,
      this.cachedIconTheme.themeExtension.extensionUri,
    );
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
