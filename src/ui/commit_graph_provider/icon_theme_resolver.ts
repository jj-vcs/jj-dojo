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

export interface ThemedFileEntry {
  name: string;
  iconClass: string;
}

export interface ResolvedTheme {
  css: string;
  themeExtensionUri?: vscode.Uri;
  files: ThemedFileEntry[];
}

const DEFAULT_EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  pyw: 'python',
  json: 'json',
  jsonc: 'jsonc',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  md: 'markdown',
  markdown: 'markdown',
  txt: 'plaintext',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  cs: 'csharp',
  java: 'java',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  bat: 'bat',
  cmd: 'bat',
  ps1: 'powershell',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  sql: 'sql',
  r: 'r',
  dart: 'dart',
  swift: 'swift',
  kt: 'kotlin',
  lua: 'lua',
  toml: 'toml',
  dockerfile: 'dockerfile',
  vue: 'vue',
  svelte: 'svelte',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'proto',
  wasm: 'wasm',
};

const DEFAULT_FILENAME_TO_LANG: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

/**
 * Resolves active VS Code file icon themes and generates minimal CSS
 * for the requested files.
 */
export class IconThemeResolver {
  public static async resolveFiles(
    webview: vscode.Webview,
    fileNames: string[],
  ): Promise<ResolvedTheme> {
    const themeId =
      vscode.workspace.getConfiguration('workbench').get<string>('iconTheme') ||
      'vs-seti';

    // Locate the extension contributing the icon theme
    let extension: vscode.Extension<unknown> | undefined;
    let themePath: string | undefined;

    for (const ext of vscode.extensions.all) {
      const iconThemes = ext.packageJSON?.contributes?.iconThemes;
      if (Array.isArray(iconThemes)) {
        const match = iconThemes.find(
          (t: {id?: string; label?: string; path: string}) =>
            t.id === themeId || (!t.id && t.label === themeId),
        );
        if (match?.path) {
          extension = ext;
          themePath = match.path;
          break;
        }
      }
    }

    // Default to built-in Seti theme
    if (!extension || !themePath) {
      extension = vscode.extensions.getExtension('vscode.theme-seti');
      themePath = './icons/vs-seti-icon-theme.json';
    }

    if (!extension || !themePath) {
      return {
        css: '',
        files: fileNames.map((name) => ({name, iconClass: ''})),
      };
    }

    const themeUri = vscode.Uri.joinPath(extension.extensionUri, themePath);
    const themeDir = vscode.Uri.joinPath(themeUri, '..');
    const rawBytes = await vscode.workspace.fs.readFile(themeUri);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = this.parseJsonc(new TextDecoder().decode(rawBytes)) as any;

    const isLight =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;
    const variant = isLight ? doc.light : undefined;

    const fileNamesMap: Record<string, string> = {
      ...doc.fileNames,
      ...variant?.fileNames,
    };
    const fileExtsMap: Record<string, string> = {
      ...doc.fileExtensions,
      ...variant?.fileExtensions,
    };
    const langIdsMap: Record<string, string> = {
      ...doc.languageIds,
      ...variant?.languageIds,
    };
    const defaultIcon = variant?.file || doc.file || '_default';

    // Map extensions and filenames to language IDs
    const extToLang: Record<string, string> = {
      ...DEFAULT_EXT_TO_LANG,
    };
    const filenameToLang: Record<string, string> = {
      ...DEFAULT_FILENAME_TO_LANG,
    };
    for (const ext of vscode.extensions.all) {
      for (const lang of ext.packageJSON?.contributes?.languages || []) {
        for (const e of lang.extensions || []) {
          extToLang[e.replace(/^\./, '').toLowerCase()] = lang.id;
        }
        for (const f of lang.filenames || []) {
          filenameToLang[f.toLowerCase()] = lang.id;
        }
      }
    }

    // Resolve icon ID for each requested file
    const resolvedFiles: ThemedFileEntry[] = fileNames.map((name) => {
      const lower = name.toLowerCase();
      let iconId = fileNamesMap[lower];
      if (!iconId) {
        const fnLang = filenameToLang[lower];
        if (fnLang && langIdsMap[fnLang]) {
          iconId = langIdsMap[fnLang];
        }
      }
      if (!iconId) {
        const ext = lower.split('.').pop() || '';
        iconId = fileExtsMap[ext];
        if (!iconId) {
          const lang = extToLang[ext];
          if (lang && langIdsMap[lang]) {
            iconId = langIdsMap[lang];
          }
        }
      }
      iconId = iconId || defaultIcon;
      return {
        name,
        iconClass: `ficon-${iconId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      };
    });

    // Generate minimal CSS only for the resolved icons
    const cssRules: string[] = [
      `.file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  line-height: 1;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  flex-shrink: 0;
}`,
    ];

    // Load fonts if theme is font-based
    const fonts = doc.fonts || [];
    for (const font of fonts) {
      if (!font.id || !font.src?.[0]?.path) continue;
      const fontUri = webview.asWebviewUri(
        vscode.Uri.joinPath(themeDir, font.src[0].path),
      );
      cssRules.push(`
@font-face {
  font-family: '${font.id}';
  src: url('${fontUri.toString()}');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}`);
    }

    const defaultFontId = fonts[0]?.id;
    const uniqueIconClasses = new Set(resolvedFiles.map((f) => f.iconClass));

    for (const [iconId, def] of Object.entries(
      (doc.iconDefinitions || {}) as Record<
        string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any
      >,
    )) {
      const className = `ficon-${iconId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      if (!uniqueIconClasses.has(className)) continue;

      if (def.iconPath) {
        const iconUri = webview.asWebviewUri(
          vscode.Uri.joinPath(themeDir, def.iconPath),
        );
        cssRules.push(`.${className} { background-image: url('${iconUri}'); }`);
      } else if (def.fontCharacter) {
        const glyph = def.fontCharacter.startsWith('\\')
          ? def.fontCharacter
          : `\\${def.fontCharacter.codePointAt(0).toString(16).toUpperCase()}`;
        const color = def.fontColor ? `color: ${def.fontColor};` : '';
        cssRules.push(`.${className}::before {
  font-family: '${def.fontId || defaultFontId}';
  content: '${glyph}';
  ${color}
  font-size: 150%;
}`);
      }
    }

    return {
      css: cssRules.join('\n'),
      themeExtensionUri: extension.extensionUri,
      files: resolvedFiles,
    };
  }

  /**
   * Safely strips comments and trailing commas from JSONC while preserving string literals.
   */
  private static parseJsonc(json: string): unknown {
    let insideString = false;
    let insideSingle = false;
    let insideMulti = false;
    let escaped = false;
    let result = '';

    for (let i = 0; i < json.length; i++) {
      const c = json[i];
      const next = json[i + 1];

      if (insideSingle) {
        if (c === '\n' || c === '\r') {
          insideSingle = false;
          result += c;
        }
      } else if (insideMulti) {
        if (c === '*' && next === '/') {
          insideMulti = false;
          i++;
        }
      } else if (insideString) {
        result += c;
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') insideString = false;
      } else {
        if (c === '"') {
          insideString = true;
          escaped = false;
          result += c;
        } else if (c === '/' && next === '/') {
          insideSingle = true;
          i++;
        } else if (c === '/' && next === '*') {
          insideMulti = true;
          i++;
        } else {
          result += c;
        }
      }
    }
    return JSON.parse(result.replace(/,\s*([\]}])/g, '$1'));
  }
}
