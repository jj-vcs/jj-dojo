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
