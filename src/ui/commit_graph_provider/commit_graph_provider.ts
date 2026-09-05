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
import {
  getWebviewApi,
  Channel,
  Disposable,
} from '../../../third_party/vscode/rpc_protocol/rpc_protocol';
import {ExtensionShape} from '../commit_graph/api/extension_shape';
import {WebviewShape} from '../commit_graph/api/webview_shape';
import {ExtensionShapeImpl} from './extension_shape_impl';
import {IconThemeResolver, ThemedFileEntry} from './icon_theme_resolver';
import {dispose} from '../../utils/dispose';

export class CommitGraphViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'jj-dojo.commit-graph';

  constructor(private readonly extensionUri: vscode.Uri) {}

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    const fileList = ['file.ts', 'abc.txt', 'mypy.py'];

    const updateTheme = async () => {
      const theme = await IconThemeResolver.resolveFiles(
        webviewView.webview,
        fileList,
      );
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          this.extensionUri,
          ...(theme.themeExtensionUri ? [theme.themeExtensionUri] : []),
        ],
      };
      return theme;
    };

    const initialTheme = await updateTheme();
    webviewView.webview.html = getHtmlForWebview(
      this.extensionUri,
      webviewView.webview,
      initialTheme.css,
      initialTheme.files,
    );

    const channel: Channel = {
      postMessage: (msg: unknown) => {
        void webviewView.webview.postMessage(msg);
      },
      onMessage: (cb: (event: unknown) => void): Disposable => {
        const sub = webviewView.webview.onDidReceiveMessage(cb);
        return {
          dispose: () => sub.dispose(),
        };
      },
    };
    const disposables: vscode.Disposable[] = [];
    const {disposable} = getWebviewApi<ExtensionShape, WebviewShape>(
      channel,
      (webviewApi) => {
        return new ExtensionShapeImpl(webviewApi);
      },
    );
    disposables.push(disposable);

    // Watch for theme and color changes to update icons automatically
    const refreshTheme = async () => {
      const theme = await updateTheme();
      void webviewView.webview.postMessage({
        type: 'update-file-icon-theme',
        css: theme.css,
        files: theme.files,
      });
    };

    disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('workbench.iconTheme')) {
          await refreshTheme();
        }
      }),
      vscode.window.onDidChangeActiveColorTheme(async () => {
        await refreshTheme();
      }),
      webviewView.onDidDispose(() => {
        dispose(disposables);
      }),
    );
  }
}

function getHtmlForWebview(
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
  themeCss: string,
  files: ThemedFileEntry[],
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      'src',
      'ui',
      'commit_graph',
      'webview_module.bundle.js',
    ),
  );
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      'src',
      'ui',
      'commit_graph',
      'components',
      '_jj_graph_base_styles.css',
    ),
  );

  const fileRowsHtml = files
    .map(
      (file) => `    <div class="file-entry-item">
      <span class="file-icon ${file.iconClass}"></span>
      <span class="file-name">${file.name}</span>
    </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JJ Dojo Commit Graph</title>
  <link rel="stylesheet" href="${cssUri}">
  <style id="file-icon-theme-styles">
${themeCss}
  </style>
  <style>
    .file-entries-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px;
      margin: 8px;
      background-color: var(--vscode-sideBar-background, rgba(128, 128, 128, 0.05));
      border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
      border-radius: 4px;
      font-family: var(--vscode-font-family);
    }
    .file-entries-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .file-entry-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 13px;
      color: var(--vscode-foreground);
    }
    .file-entry-item:hover {
      background-color: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.1));
    }
    .file-entry-item .file-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
  <script type="module" src="${scriptUri}"></script>
  <script>
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message && message.type === 'update-file-icon-theme') {
        const styleEl = document.getElementById('file-icon-theme-styles');
        if (styleEl) {
          styleEl.textContent = message.css;
        }
        if (message.files) {
          const container = document.getElementById('file-entries-container');
          if (container) {
            const rows = message.files
              .map(
                (f) =>
                  '<div class="file-entry-item">' +
                  '<span class="file-icon ' +
                  f.iconClass +
                  '"></span>' +
                  '<span class="file-name">' +
                  f.name +
                  '</span>' +
                  '</div>',
              )
              .join('');
            container.innerHTML =
              '<div class="file-entries-header">Files</div>' + rows;
          }
        }
      }
    });
  </script>
</head>
<body>
  <div class="file-entries-list" id="file-entries-container">
    <div class="file-entries-header">Files</div>
${fileRowsHtml}
  </div>
  <jj-context-menu-provider></jj-context-menu-provider>
  <jj-app id="jj-app"></jj-app>
</body>
</html>`;
}
