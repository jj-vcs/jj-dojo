/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Copyright: This file was implemented independently without prior knowledge of its
 * equivalent VS Code implementation (src/vs/workbench/services/extensions/common/rpcProtocol.ts).
 * However, because it bears similarities, this work is attributed to and licensed under the
 * VS Code license.
 *
 * In VS Code, the communication between an Extension and its webviews
 * are done through one-way postMessage calls:
 * - https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-an-extension-to-a-webview
 * - https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-a-webview-to-an-extension
 * This can be a bit inconvenient to use if either the extension or the webview expects
 * a reply from the other side. This file exposes a `getExtensionApi` and `getWebviewApi`
 * call that allows a two-way communication between an extension and its webviews.
 *
 * Another problem our `getExtensionApi` and `getWebviewApi` solves is avoiding lost messages.
 * It can take webview time to start and load, and any messages passed before its ready may
 * be lost. This is fixed by only exposing the rpc interface when both sides are ready.
 */

import {
  createHandShakeMessage,
  createRpcRequest,
  createRpcResponse,
  isHandShakeMessage,
  isRpcRequest,
  isRpcResponse,
} from './rpc_protocol_utils';

/**
 * Retrieves the extension API. This function should only be used within a webview.
 * It provides an interface to call functions exposed by the extension. It resolves
 * only after both the extension and webview channels are initialized and ready for
 * communication. Methods defined in the extension/webview apis that intends to be
 * exposed to the other side must be prefixed with a dollar sign "$".
 *
 * @param channel The channel used to communicate with the extension.
 * @param cb Given the api webview can use to call the extension, provide the
 * implementation that should be invoked when the extension calls the webview.
 * @param disposables The caller is responsible for disposing `disposables` once
 * the communication channel is no longer needed.
 */
export async function getExtensionApi<E, W>(
  channel: Channel,
  cb: (extensionApi: E) => W,
  disposables: Disposable[],
): Promise<E> {
  const extensionApi: E = createSender(channel, disposables);
  createReceiver(channel, cb(extensionApi), disposables);
  await shakeHands(channel);
  return extensionApi;
}

/**
 * Retrieves the webview API. This function should only be used within an extension.
 * It provides an interface to call functions exposed by the webview. It resolves
 * only after both the extension and webview channels are initialized and ready for
 * communication. Methods defined in the extension/webview apis that intends to be
 * exposed to the other side must be prefixed with a dollar sign "$".
 *
 * @param channel The channel used to communicate with the webview.
 * @param cb Given the api extension can use to call the webview, provide the
 * implementation that should be invoked when the webview calls the extension.
 * @param disposables The caller is responsible for disposing `disposables` once
 * the communication channel is no longer needed.
 */
export async function getWebviewApi<E, W>(
  channel: Channel,
  cb: (webviewApi: W) => E,
  disposables: Disposable[],
): Promise<W> {
  const webviewApi: W = createSender(channel, disposables);
  createReceiver(channel, cb(webviewApi), disposables);
  await shakeHands(channel);
  return webviewApi;
}

/**
 * A disposable object, similar to vscode.Disposable.
 * Declared separately to avoid a dependency on the vscode module.
 */
export interface Disposable {
  // `dispose()` should be called when the object is no longer
  // needed to clean up allocated resources.
  dispose(): void;
}

/**
 * A channel for sending and receiving messages.
 */
export interface Channel {
  postMessage(message: unknown): void;
  onMessage(callback: (event: unknown) => void): Disposable;
}

// If the rpc succeeded, `response` is set. Otherwise `err` is set.
type Callback = (response: unknown, err: unknown) => void;

function createSender(channel: Channel, disposables: Disposable[]) {
  const pending = new Map<number, Callback>();
  disposables.push(
    channel.onMessage((event: unknown) => {
      // We may not be the only one using this channel, ignore any
      // messages not following our custom formats.
      if (!isRpcResponse(event)) {
        return;
      }
      const {response, id, err} = event.data;
      // We got a response from the other side, invoke the stored
      // callback.
      pending.get(id)?.(response, err);
      pending.delete(id);
    }),
  );
  disposables.push({
    dispose: () => {
      for (const [, cb] of pending) {
        cb(undefined, new Error('RPC channel disposed'));
      }
      pending.clear();
    },
  });
  return createSenderProxy(channel, pending);
}

function createSenderProxy(channel: Channel, pending: Map<number, Callback>) {
  let counter = 0;
  const handler = {
    get: (_target: unknown, name: string) => {
      // Only hijack functions started with the '$' character.
      if (typeof name !== 'string' || name.charAt(0) !== '$') {
        return undefined;
      }
      return (...args: unknown[]) => {
        // Create an identifier that is used to track the ID of a request.
        // e.g. We send a request to the other side with a unique id, and the
        // other side is expected to pass back a response with the same id.
        const id = ++counter;
        channel.postMessage(createRpcRequest({name, args, id}));
        return new Promise((resolve, reject) => {
          pending.set(id, (response: unknown, err: unknown) => {
            if (err !== undefined) {
              reject(err as Error);
            } else {
              resolve(response);
            }
          });
        });
      };
    },
  };
  return new Proxy(Object.create(null), handler);
}

function createReceiver<T>(
  channel: Channel,
  impl: T,
  disposables: Disposable[],
) {
  disposables.push(
    channel.onMessage(async (event) => {
      // We may not be the only one using this channel, ignore any
      // messages not following our custom formats.
      if (!isRpcRequest(event)) {
        return;
      }
      const {name, args, id} = event.data;
      let response;
      let err;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response = await (impl as any)[name]?.(...args);
      } catch (e: unknown) {
        err = e;
      }
      channel.postMessage(createRpcResponse({id, response, err}));
    }),
  );
}

// Returns once the other side has ACKed our message.
//
// Since webviews can take time to start, it is a good idea to call
// this function to ensure it is fully up and ready before providing
// the rpc interface to the user of our rpc protocol.
async function shakeHands(channel: Channel) {
  // This is safe to disable as long as the async callback
  // does not throw any error.
  //
  // eslint-disable-next-line no-async-promise-executor
  return new Promise<void>(async (resolve, reject) => {
    const data = {
      weHaveReceived: false,
      theyHaveReceived: false,
    };

    const disposable = channel.onMessage((message: unknown) => {
      if (!isHandShakeMessage(message)) {
        return;
      }
      if (data.theyHaveReceived) {
        return;
      }
      data.weHaveReceived = true;
      data.theyHaveReceived = message.received;
      if (data.theyHaveReceived) {
        disposable.dispose();
        resolve();
      }
    });

    // Give a max of 10 seconds (0.1s * 100) for the webview to load.
    const sleepSeconds = 0.1;
    const repeat = 100;
    for (let i = 0; i < repeat; i++) {
      channel.postMessage(
        createHandShakeMessage({received: data.weHaveReceived}),
      );
      // Should still post a final message even if they have received.
      if (data.theyHaveReceived) {
        break;
      }
      await sleep(sleepSeconds * 1000);
    }

    if (!data.theyHaveReceived) {
      disposable.dispose();
      reject(new Error(`Handshake timed out after ${sleepSeconds * repeat}s`));
    }
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
