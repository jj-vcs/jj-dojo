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
