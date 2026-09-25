/**
 * Copyright 2026 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '../../testing/install_global_vscode';
import 'jasmine';
import * as vscode from 'vscode';
import {FakeExtension, FakeWebview} from '../../testing/fakes';
import {fakeVscode, installVscode} from '../../testing/install_vscode';
import {IconThemeService} from './icon_theme_service';

describe('IconThemeService', () => {
  beforeEach(installVscode);

  it('resolves image file icons', async () => {
    // Inlined icon theme JSON using image paths (SVG) per VS Code icon theme specification.
    const iconThemeJson = JSON.stringify({
      iconDefinitions: {
        _file: {
          iconPath: './images/file.svg',
        },
        _ts: {
          iconPath: './images/typescript.svg',
        },
      },
      file: '_file',
      fileExtensions: {
        ts: '_ts',
      },
    });

    const extensionUri = vscode.Uri.file('/fake/extension');
    const themePath = './icons/icon-theme.json';
    const themeUri = vscode.Uri.joinPath(extensionUri, themePath);

    const extension = new FakeExtension({
      id: 'test.icon-theme-extension',
      extensionUri,
      packageJSON: {
        contributes: {
          iconThemes: [
            {
              id: 'test-icon-theme',
              label: 'Test Icon Theme',
              path: themePath,
            },
          ],
        },
      },
    });

    const vsc = fakeVscode();
    vsc.extensions.all = [extension];
    await vsc.workspace
      .getConfiguration('workbench')
      .update('iconTheme', 'test-icon-theme');
    vsc.workspace.fs.writeFile(themeUri, iconThemeJson);

    const webview = new FakeWebview();
    const service = new IconThemeService(webview);
    await service.loadTheme();

    expect(service.getFileIcon('file.ts')).toEqual({
      iconUri:
        'vscode-webview://test-authority/fake/extension/icons/images/typescript.svg',
    });
    expect(service.getFileIcon('other.txt')).toEqual({
      iconUri:
        'vscode-webview://test-authority/fake/extension/icons/images/file.svg',
    });
  });

  it('resolves font-based file icons', async () => {
    // Inlined icon theme JSON using font glyphs per VS Code icon theme specification.
    const fontThemeJson = JSON.stringify({
      fonts: [
        {
          id: 'test-font',
          src: [
            {
              path: './fonts/test-font.woff',
              format: 'woff',
            },
          ],
        },
      ],
      iconDefinitions: {
        _file: {
          fontCharacter: '\\E001',
          fontColor: '#cccccc',
        },
        _ts: {
          fontCharacter: '\\E002',
          fontColor: '#519aba',
          fontId: 'test-font',
        },
      },
      file: '_file',
      fileExtensions: {
        ts: '_ts',
      },
    });

    const extensionUri = vscode.Uri.file('/fake/font-extension');
    const themePath = './icons/font-theme.json';
    const themeUri = vscode.Uri.joinPath(extensionUri, themePath);

    const extension = new FakeExtension({
      id: 'test.font-theme-extension',
      extensionUri,
      packageJSON: {
        contributes: {
          iconThemes: [
            {
              id: 'test-font-theme',
              label: 'Test Font Theme',
              path: themePath,
            },
          ],
        },
      },
    });

    const vsc = fakeVscode();
    vsc.extensions.all = [extension];
    await vsc.workspace
      .getConfiguration('workbench')
      .update('iconTheme', 'test-font-theme');
    vsc.workspace.fs.writeFile(themeUri, fontThemeJson);

    const webview = new FakeWebview();
    const service = new IconThemeService(webview);
    await service.loadTheme();

    expect(service.getFileIcon('file.ts')).toEqual({
      font: {
        fontCharacter: '\\E002',
        fontColor: '#519aba',
        fontFamily: 'test-font',
        fontUri:
          'vscode-webview://test-authority/fake/font-extension/icons/fonts/test-font.woff',
      },
    });
    expect(service.getFileIcon('other.txt')).toEqual({
      font: {
        fontCharacter: '\\E001',
        fontColor: '#cccccc',
        fontFamily: 'test-font',
        fontUri:
          'vscode-webview://test-authority/fake/font-extension/icons/fonts/test-font.woff',
      },
    });
  });
});
