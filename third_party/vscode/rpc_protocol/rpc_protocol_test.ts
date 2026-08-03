/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

    // Start both handshakes in parallel
    const disposables: Disposable[] = [];
    const getExtensionApiPromise = getExtensionApi<ExtensionApi, WebviewApi>(
      webviewChannel,
      (_extApi) => webviewImpl,
      disposables,
    );

    const getWebviewApiPromise = getWebviewApi<ExtensionApi, WebviewApi>(
      extensionChannel,
      (_webApi) => extensionImpl,
      disposables,
    );

    const [extApi, webApi] = await Promise.all([
      getExtensionApiPromise,
      getWebviewApiPromise,
    ]);

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

    dispose(disposables);
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

    const disposables: Disposable[] = [];
    const getExtensionApiPromise = getExtensionApi<ExtensionApi, WebviewApi>(
      webviewChannel,
      (_extApi) => webviewImpl,
      disposables,
    );

    const getWebviewApiPromise = getWebviewApi<ExtensionApi, WebviewApi>(
      extensionChannel,
      (_webApi) => extensionImpl,
      disposables,
    );

    const [extApi] = await Promise.all([
      getExtensionApiPromise,
      getWebviewApiPromise,
    ]);

    try {
      await extApi.$fail();
      fail('Should have thrown');
    } catch (e: unknown) {
      // The error returned might be serialized, but in our mock it's passed directly.
      // However, if it is serialized, it might just be an object with message, or it might be the Error object.
      // Let's check if it is an Error or has the message.
      expect(e).toBeDefined();
      expect((e as Error).message || e).toContain('Intentional failure');
    }
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

    const disposables: Disposable[] = [];
    const getExtensionApiPromise = getExtensionApi<ExtensionApi, WebviewApi>(
      webviewChannel,
      (_extApi) => webviewImpl,
      disposables,
    );

    const getWebviewApiPromise = getWebviewApi<ExtensionApi, WebviewApi>(
      extensionChannel,
      (_webApi) => extensionImpl,
      disposables,
    );

    const [extApi] = await Promise.all([
      getExtensionApiPromise,
      getWebviewApiPromise,
    ]);

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

    dispose(disposables);
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

    const disposables: Disposable[] = [];
    const getExtensionApiPromise = getExtensionApi<ExtensionApi, WebviewApi>(
      webviewChannel,
      (_extApi) => webviewImpl,
      disposables,
    );

    const getWebviewApiPromise = getWebviewApi<ExtensionApi, WebviewApi>(
      extensionChannel,
      (_webApi) => extensionImpl,
      disposables,
    );

    const [extApi] = await Promise.all([
      getExtensionApiPromise,
      getWebviewApiPromise,
    ]);

    const helloResponse = await extApi.$hello('World');
    expect(helloResponse).toBe('Hello from class, World');

    dispose(disposables);
  });
});

function dispose(disposables: Disposable[]) {
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables.length = 0;
}
