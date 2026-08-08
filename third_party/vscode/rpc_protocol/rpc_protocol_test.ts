/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'jasmine';
import {
  Channel,
  Disposable,
  getExtensionApi,
  getWebviewApi,
} from './rpc_protocol';

class MockChannel implements Channel {
  readonly listeners = new Set<(event: unknown) => void>();
  otherSide?: MockChannel;

  postMessage(message: unknown): void {
    setTimeout(() => {
      if (this.otherSide) {
        for (const listener of this.otherSide.listeners) {
          try {
            listener(message);
          } catch (e) {
            console.error('Error in message listener', e);
          }
        }
      }
    }, 0);
  }

  onMessage(callback: (event: unknown) => void): Disposable {
    this.listeners.add(callback);
    return {
      dispose: () => {
        this.listeners.delete(callback);
      },
    };
  }
}

interface ExtensionApi {
  $hello(name: string): Promise<string>;
  $fail(): Promise<void>;
  $add(a: number, b: number): Promise<number>;
}

interface WebviewApi {
  $notify(message: string): Promise<void>;
}

describe('rpc_protocol', () => {
  let webviewChannel: MockChannel;
  let extensionChannel: MockChannel;

  beforeEach(() => {
    webviewChannel = new MockChannel();
    extensionChannel = new MockChannel();
    webviewChannel.otherSide = extensionChannel;
    extensionChannel.otherSide = webviewChannel;
  });

  it('should complete handshake and allow bidirectional RPC calls', async () => {
    const extensionImpl: ExtensionApi = {
      $hello: async (name: string) => `Hello, ${name}`,
      $fail: async () => {
        throw new Error('Extension failed');
      },
      $add: async (a: number, b: number) => a + b,
    };

    let notifiedMessage: string | undefined;
    const webviewImpl: WebviewApi = {
      $notify: async (message: string) => {
        notifiedMessage = message;
      },
    };

    // Initialize both APIs synchronously
    const {api: extApi, disposable: extDisposable} = getExtensionApi<
      ExtensionApi,
      WebviewApi
    >(webviewChannel, (_extApi) => webviewImpl);

    const {api: webApi, disposable: webDisposable} = getWebviewApi<
      ExtensionApi,
      WebviewApi
    >(extensionChannel, (_webApi) => extensionImpl);

    expect(extApi).toBeDefined();
    expect(webApi).toBeDefined();

    // Test Webview calling Extension
    const helloResponse = await extApi.$hello('World');
    expect(helloResponse).toBe('Hello, World');

    const addResponse = await extApi.$add(2, 3);
    expect(addResponse).toBe(5);

    // Test Extension calling Webview
    await webApi.$notify('Test Message');
    expect(notifiedMessage).toBe('Test Message');

    extDisposable.dispose();
    webDisposable.dispose();
  });

  it('should return API objects synchronously and block calls until handshake completes', async () => {
    let handshakeCompleted = false;

    const extensionImpl: ExtensionApi = {
      $hello: async (name: string) => {
        expect(handshakeCompleted).toBeTrue();
        return `Hello, ${name}`;
      },
      $fail: async () => {},
      $add: async (a: number, b: number) => a + b,
    };

    const webviewImpl: WebviewApi = {
      $notify: async () => {},
    };

    // Call getExtensionApi and getWebviewApi synchronously
    const {api: extApi, disposable: extDisposable} = getExtensionApi<
      ExtensionApi,
      WebviewApi
    >(webviewChannel, (_extApi) => webviewImpl);

    const {api: webApi, disposable: webDisposable} = getWebviewApi<
      ExtensionApi,
      WebviewApi
    >(extensionChannel, (_webApi) => extensionImpl);

    expect(extApi).toBeDefined();
    expect(webApi).toBeDefined();

    // Call $hello immediately before handshake has completed
    const helloPromise = extApi.$hello('World');

    // Give handshake a tick to complete (MockChannel uses setTimeout 0)
    await new Promise((resolve) => setTimeout(resolve, 20));
    handshakeCompleted = true;

    const response = await helloPromise;
    expect(response).toBe('Hello, World');

    extDisposable.dispose();
    webDisposable.dispose();
  });

  it('should propagate errors from implementation to caller', async () => {
    const extensionImpl: ExtensionApi = {
      $hello: async () => '',
      $fail: async () => {
        throw new Error('Intentional failure');
      },
      $add: async () => 0,
    };

    const webviewImpl: WebviewApi = {
      $notify: async () => {},
    };

    const {api: extApi, disposable: extDisposable} = getExtensionApi<
      ExtensionApi,
      WebviewApi
    >(webviewChannel, (_extApi) => webviewImpl);

    const {disposable: webDisposable} = getWebviewApi<ExtensionApi, WebviewApi>(
      extensionChannel,
      (_webApi) => extensionImpl,
    );

    try {
      await extApi.$fail();
      fail('Should have thrown');
    } catch (e: unknown) {
      expect(e).toBeDefined();
      expect((e as Error).message || e).toContain('Intentional failure');
    }

    extDisposable.dispose();
    webDisposable.dispose();
  });

  it('should handle concurrent RPC calls correctly', async () => {
    const extensionImpl: ExtensionApi = {
      $hello: async (name: string) => {
        // Add some delay to ensure concurrency
        await new Promise((resolve) => setTimeout(resolve, 50));
        return `Hello, ${name}`;
      },
      $fail: async () => {},
      $add: async (a: number, b: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return a + b;
      },
    };

    const webviewImpl: WebviewApi = {
      $notify: async () => {},
    };

    const {api: extApi, disposable: extDisposable} = getExtensionApi<
      ExtensionApi,
      WebviewApi
    >(webviewChannel, (_extApi) => webviewImpl);

    const {disposable: webDisposable} = getWebviewApi<ExtensionApi, WebviewApi>(
      extensionChannel,
      (_webApi) => extensionImpl,
    );

    // Fire multiple requests concurrently
    const results = await Promise.all([
      extApi.$hello('Alice'),
      extApi.$add(10, 20),
      extApi.$hello('Bob'),
      extApi.$add(1, 2),
    ]);

    expect(results[0]).toBe('Hello, Alice');
    expect(results[1]).toBe(30);
    expect(results[2]).toBe('Hello, Bob');
    expect(results[3]).toBe(3);

    extDisposable.dispose();
    webDisposable.dispose();
  });

  it('should preserve `this` context when invoking implementation methods', async () => {
    class ExtensionImpl implements ExtensionApi {
      private prefix = 'Hello from class';

      async $hello(name: string): Promise<string> {
        return `${this.prefix}, ${name}`;
      }

      async $fail(): Promise<void> {}

      async $add(a: number, b: number): Promise<number> {
        return a + b;
      }
    }

    const extensionImpl = new ExtensionImpl();
    const webviewImpl: WebviewApi = {
      $notify: async () => {},
    };

    const {api: extApi, disposable: extDisposable} = getExtensionApi<
      ExtensionApi,
      WebviewApi
    >(webviewChannel, (_extApi) => webviewImpl);

    const {disposable: webDisposable} = getWebviewApi<ExtensionApi, WebviewApi>(
      extensionChannel,
      (_webApi) => extensionImpl,
    );

    const helloResponse = await extApi.$hello('World');
    expect(helloResponse).toBe('Hello from class, World');

    extDisposable.dispose();
    webDisposable.dispose();
  });

  it('should clean up channel resources when disposable is disposed', async () => {
    const extensionImpl: ExtensionApi = {
      $hello: async (name: string) => `Hello, ${name}`,
      $fail: async () => {},
      $add: async (a: number, b: number) => a + b,
    };

    const webviewImpl: WebviewApi = {
      $notify: async () => {},
    };

    const {api: extApi, disposable: extDisposable} = getExtensionApi<
      ExtensionApi,
      WebviewApi
    >(webviewChannel, (_extApi) => webviewImpl);

    const {disposable: webDisposable} = getWebviewApi<ExtensionApi, WebviewApi>(
      extensionChannel,
      (_webApi) => extensionImpl,
    );

    // Make sure handshake completes
    await extApi.$hello('World');

    // Dispose extDisposable
    extDisposable.dispose();
    webDisposable.dispose();

    // Verify listeners clean up
    expect(webviewChannel.listeners.size).toBe(0);
    expect(extensionChannel.listeners.size).toBe(0);
  });
});
