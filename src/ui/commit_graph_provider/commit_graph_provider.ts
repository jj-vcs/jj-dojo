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
import {dispose} from '../../utils/dispose';

export class CommitGraphViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'jj-dojo.commit-graph';

  constructor(private readonly extensionUri: vscode.Uri) {}

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = getHtmlForWebview(
      this.extensionUri,
      webviewView.webview,
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
    disposables.push(
      webviewView.onDidDispose(() => {
        dispose(disposables);
      }),
    );
  }
}

function getHtmlForWebview(
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JJ Dojo Commit Graph</title>
  <link rel="stylesheet" href="${cssUri}">
  <script type="module" src="${scriptUri}"></script>
</head>
<body>
  <jj-context-menu-provider></jj-context-menu-provider>
  <jj-app id="jj-app"></jj-app>
</body>
</html>`;
}
