/**
 * See https://code.visualstudio.com/api/extension-guides/file-icon-theme
 * for the definitions of these fields.
 */

import {parse} from 'jsonc-parser';

export interface IconDefinition {
  iconPath?: string;
  fontCharacter?: string;
  fontColor?: string;
  fontId?: string;
  fontSize?: string;
}

export interface ThemeFontSrc {
  path: string;
  format?: string;
}

export interface ThemeFont {
  id?: string;
  src?: ThemeFontSrc[];
  weight?: string;
  style?: string;
  size?: string;
}

export interface IconThemeVariant {
  file?: string;
  folder?: string;
  folderExpanded?: string;
  fileNames?: Record<string, string>;
  fileExtensions?: Record<string, string>;
  languageIds?: Record<string, string>;
  iconDefinitions?: Record<string, IconDefinition>;
}

export interface IconThemeDocument extends IconThemeVariant {
  fonts?: ThemeFont[];
  light?: IconThemeVariant;
  highContrast?: IconThemeVariant;
}

export function parseIconThemeJson(json: string): IconThemeDocument {
  return parse(json) as IconThemeDocument;
}
