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
import {FakeEventEmitter} from './fake_event_emitter';

export class FakeWebview implements vscode.Webview {
  options: vscode.WebviewOptions;
  html = '';
  readonly cspSource = 'vscode-webview:';

  readonly onDidReceiveMessageEmitter = new FakeEventEmitter<unknown>();
  readonly onDidReceiveMessage: vscode.Event<unknown> =
    this.onDidReceiveMessageEmitter.event;

  constructor(options: vscode.WebviewOptions = {localResourceRoots: []}) {
    this.options = options;
  }

  asWebviewUri(localResource: vscode.Uri): vscode.Uri {
    return vscode.Uri.parse(
      `vscode-webview://test-authority${localResource.path}`,
    );
  }

  async postMessage(_message: unknown): Promise<boolean> {
    return true;
  }
}
