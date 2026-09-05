import * as vscode from 'vscode';

import {
  IconDefinition,
  IconThemeDocument,
  parseIconThemeJson,
  ThemeFont,
} from './icon_theme_json_parser';

export class IconTheme {
  /** fileName/fileExt/languageId to icon id mappings contributed by the current theme */
  private fileNameToIconId: Record<string, string>;
  private fileExtToIconId: Record<string, string>;
  private languageIdToIconId: Record<string, string>;

  /** The default icon to use if no icon id mapping for a file is found */
  private defaultIconId: string;

  /** File name/ext to language id mappings contributed by all installed vscode extensions */
  private fileNameToLanguageId: Record<string, string>;
  private fileExtensionToLanguageId: Record<string, string>;

  private constructor(
    readonly themeId: string,
    readonly themeExtension: vscode.Extension<unknown>,
    /** The path to the directory containing the icon theme .json file */
    readonly themeDir: vscode.Uri,
    private readonly doc: IconThemeDocument,
  ) {
    const isLight =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;
    const variant = isLight ? doc.light : undefined;

    this.fileNameToIconId = {
      ...doc.fileNames,
      ...variant?.fileNames,
    };
    this.fileExtToIconId = {
      ...doc.fileExtensions,
      ...variant?.fileExtensions,
    };
    this.languageIdToIconId = {
      ...doc.languageIds,
      ...variant?.languageIds,
    };
    this.defaultIconId = variant?.file || doc.file || '_default';

    const contrib = getFileToLanguageIdContributions();
    this.fileExtensionToLanguageId = contrib.fileExtensionToLanguageId;
    this.fileNameToLanguageId = contrib.fileNameToLanguageId;
  }

  getIconId(fileName: string) {
    const lower = fileName.toLowerCase();
    let iconId = this.fileNameToIconId[lower];
    if (!iconId) {
      const langId = this.fileNameToLanguageId[lower];
      if (langId && this.languageIdToIconId[langId]) {
        iconId = this.languageIdToIconId[langId];
      }
    }
    if (!iconId) {
      const ext = lower.split('.').pop() || '';
      iconId = this.fileExtToIconId[ext];
      if (!iconId) {
        const langId = this.fileExtensionToLanguageId[ext];
        if (langId && this.languageIdToIconId[langId]) {
          iconId = this.languageIdToIconId[langId];
        }
      }
    }
    return iconId || this.defaultIconId;
  }

  getIconDefinition(iconId: string): IconDefinition | undefined {
    return this.doc.iconDefinitions?.[iconId];
  }

  getFonts(): ThemeFont[] {
    return this.doc.fonts ?? [];
  }

  static async load(themeId: string): Promise<IconTheme> {
    // Locate the extension contributing the icon theme
    const {themeExtension, themePath} = getIconThemeExtension(themeId);
    const themeUri = vscode.Uri.joinPath(
      themeExtension.extensionUri,
      themePath,
    );
    const rawBytes = await vscode.workspace.fs.readFile(themeUri);
    const doc = parseIconThemeJson(new TextDecoder().decode(rawBytes));
    const themeDir = vscode.Uri.joinPath(themeUri, '..');
    return new IconTheme(themeId, themeExtension, themeDir, doc);
  }
}

/**
 * Given an icon theme id, return the corresponding extension and the
 * path to its theme. If the theme cannot be found, default to the
 * built-in Seti theme.
 */
function getIconThemeExtension(themeId: string): {
  themeExtension: vscode.Extension<unknown>;
  themePath: string;
} {
  for (const ext of vscode.extensions.all) {
    const iconThemes = ext.packageJSON?.contributes?.iconThemes;
    if (Array.isArray(iconThemes)) {
      const match = iconThemes.find(
        (t: {id?: string; label?: string; path: string}) =>
          t.id === themeId || (!t.id && t.label === themeId),
      );
      if (match?.path) {
        return {
          themeExtension: ext,
          themePath: match.path,
        };
      }
    }
  }

  // Default to built-in Seti theme
  const ext = vscode.extensions.getExtension('vscode.theme-seti');
  if (!ext) {
    throw new Error('Cannot find built-in VS Code Seti theme');
  }
  return {
    themeExtension: ext,
    themePath: './icons/vs-seti-icon-theme.json',
  };
}

function getFileToLanguageIdContributions() {
  const fileExtensionToLanguageId: Record<string, string> = {};
  const fileNameToLanguageId: Record<string, string> = {};
  for (const ext of vscode.extensions.all) {
    for (const lang of ext.packageJSON?.contributes?.languages || []) {
      for (const e of lang.extensions || []) {
        fileExtensionToLanguageId[e.replace(/^\./, '').toLowerCase()] = lang.id;
      }
      for (const f of lang.filenames || []) {
        fileNameToLanguageId[f.toLowerCase()] = lang.id;
      }
    }
  }
  return {
    fileExtensionToLanguageId,
    fileNameToLanguageId,
  };
}
