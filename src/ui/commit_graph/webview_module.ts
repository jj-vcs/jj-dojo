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

import './components/app';

import {
  Channel,
  getExtensionApi,
} from '../../../third_party/vscode/rpc_protocol/rpc_protocol';
import type {ExtensionShape} from './api/extension_shape';
import type {CommitGraphState} from './api/types';
import {WebviewShape} from './api/webview_shape';
import {JjApp} from './components/app';

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

function main() {
  const vscode = acquireVsCodeApi();
  const channel: Channel = {
    postMessage: (message: unknown) => {
      vscode.postMessage(message as {});
    },
    onMessage: (callback: (event: unknown) => void) => {
      const listener = (event: MessageEvent) => {
        callback(event.data);
      };
      window.addEventListener('message', listener);
      return {
        dispose: () => {
          window.removeEventListener('message', listener);
        },
      };
    },
  };
  // The disposable returned by getExtensionApi() is not cleaned up here.
  // The allocated resources should be cleaned up when the webview is disposed.
  getExtensionApi<ExtensionShape, WebviewShape>(channel, (extensionApi) => {
    const jjApp = document.getElementById('jj-app') as JjApp;
    jjApp.extensionApi = extensionApi;
    void extensionApi.$webviewReady();
    return {
      async $setStates(states: CommitGraphState[]) {
        await jjApp.setStates(states);
      },
    };
  });
}

main();
