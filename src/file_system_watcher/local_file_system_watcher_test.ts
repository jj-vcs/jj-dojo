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

/// <reference types="node" />

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as watcher from '@parcel/watcher';
import {installVscode, logs} from '../testing/install_vscode';
import {LocalFileSystemWatcher} from './local_file_system_watcher';
import {FileChangeType, SnapshotDelta} from './file_system_watcher';
import {OutputChannelLogger} from '../logging/output_channel_logger';
import {setGlobalLogger, removeGlobalLogger} from '../logging/logging';

function waitForSnapshot(
  receivedDeltas: Array<SnapshotDelta | undefined>,
  predicate: (delta: SnapshotDelta) => boolean,
): Promise<SnapshotDelta> {
  const timeoutMs = 30000;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const found = receivedDeltas.find((d) => d !== undefined && predicate(d));
      if (found) {
        clearInterval(interval);
        resolve(found);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(
          new Error(
            `Timeout waiting for snapshot delta. Received ${receivedDeltas.length} deltas: ` +
              JSON.stringify(receivedDeltas),
          ),
        );
      }
    }, 100);
  });
}

describe('LocalFileSystemWatcher (Integration with @parcel/watcher)', () => {
  let tmpDir: string;
  let watcherInstance: LocalFileSystemWatcher | null = null;

  beforeEach(() => {
    installVscode();
    const logger = new OutputChannelLogger();
    setGlobalLogger(logger);
    tmpDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'local-fs-watcher-test-')),
    );
  });

  afterEach(async () => {
    if (watcherInstance) {
      await watcherInstance.dispose();
      watcherInstance = null;
    }
    fs.rmSync(tmpDir, {recursive: true, force: true});
    removeGlobalLogger();
  });

  it('should notify subscribers with ADDED when a new file is created', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'new_file.txt');
    fs.writeFileSync(filePath, 'hello world');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.uri.fsPath === filePath && c.type === FileChangeType.ADDED,
      ),
    );

    expect(delta.snapshotNumber).toBeGreaterThan(0);
    expect(delta.stateChanged).toBe(false);
  });

  it('should notify subscribers with MODIFIED when an existing file is updated', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'existing_file.txt');
    fs.writeFileSync(filePath, 'initial content');

    await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.uri.fsPath === filePath && c.type === FileChangeType.ADDED,
      ),
    );

    fs.writeFileSync(filePath, 'updated content');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.uri.fsPath === filePath && c.type === FileChangeType.MODIFIED,
      ),
    );

    expect(delta.stateChanged).toBe(false);
  });

  it('should notify subscribers with DELETED when a file is deleted', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'to_delete.txt');
    fs.writeFileSync(filePath, 'delete me');

    await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.uri.fsPath === filePath && c.type === FileChangeType.ADDED,
      ),
    );

    fs.unlinkSync(filePath);

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.uri.fsPath === filePath && c.type === FileChangeType.DELETED,
      ),
    );

    expect(delta.stateChanged).toBe(false);
  });

  it('should set stateChanged to true when .jj/working_copy/checkout changes', async () => {
    const jjDir = path.join(tmpDir, '.jj', 'working_copy');
    fs.mkdirSync(jjDir, {recursive: true});

    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const checkoutPath = path.join(jjDir, 'checkout');
    fs.writeFileSync(checkoutPath, 'commit-xyz');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === checkoutPath),
    );

    expect(delta.stateChanged).toBe(true);
  });

  it('should not set stateChanged to true when nested workspace checkout changes', async () => {
    const nestedJjDir = path.join(tmpDir, 'nested_repo', '.jj', 'working_copy');
    fs.mkdirSync(nestedJjDir, {recursive: true});

    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const nestedCheckoutPath = path.join(nestedJjDir, 'checkout');
    fs.writeFileSync(nestedCheckoutPath, 'commit-nested');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === nestedCheckoutPath),
    );

    expect(delta.stateChanged).toBe(false);
  });

  it('should not set stateChanged to true when foo.jj/working_copy/checkout changes', async () => {
    const fakeJjDir = path.join(tmpDir, 'foo.jj', 'working_copy');
    fs.mkdirSync(fakeJjDir, {recursive: true});

    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const fakeCheckoutPath = path.join(fakeJjDir, 'checkout');
    fs.writeFileSync(fakeCheckoutPath, 'commit-fake');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === fakeCheckoutPath),
    );

    expect(delta.stateChanged).toBe(false);
  });

  it('should notify multiple subscribers independently', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas1: Array<SnapshotDelta | undefined> = [];
    const deltas2: Array<SnapshotDelta | undefined> = [];

    watcherInstance.subscribe((d) => deltas1.push(d));
    watcherInstance.subscribe((d) => deltas2.push(d));

    const filePath = path.join(tmpDir, 'shared.txt');
    fs.writeFileSync(filePath, 'shared content');

    const delta1 = await waitForSnapshot(deltas1, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === filePath),
    );
    const delta2 = await waitForSnapshot(deltas2, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === filePath),
    );

    const change1 = delta1.fileChanges.find((c) => c.uri.fsPath === filePath);
    const change2 = delta2.fileChanges.find((c) => c.uri.fsPath === filePath);
    expect(change1).toBeDefined();
    expect(change2).toBeDefined();
  });

  it('should stop receiving updates after disposing a subscription', async () => {
    let capturedCallback!: watcher.SubscribeCallback;
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_path, cb) => {
        capturedCallback = cb;
        return fakeSubscription;
      },
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    const subscription = watcherInstance.subscribe((d) => deltas.push(d));

    // First event: should be received
    capturedCallback(null, [
      {path: path.join(tmpDir, 'file1.txt'), type: 'create'},
    ]);
    expect(deltas.length).toBe(1);

    // Dispose subscription
    subscription.dispose();

    // Second event: should NOT be received
    capturedCallback(null, [
      {path: path.join(tmpDir, 'file2.txt'), type: 'create'},
    ]);
    expect(deltas.length).toBe(1);
    watcherInstance = null;
  });

  it('should isolate subscriber errors so other subscribers still receive updates', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe(() => {
      throw new Error('Subscriber error simulation');
    });
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'resilient.txt');
    fs.writeFileSync(filePath, 'resilient content');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === filePath),
    );

    expect(delta).toBeDefined();
    expect(
      logs().messages.some(
        (msg) =>
          msg[0] === 'ERROR' &&
          String(msg[1]).includes('Subscriber error simulation'),
      ),
    ).toBe(true);
  });

  it('should unsubscribe properly when the watcher is disposed', async () => {
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async () => fakeSubscription,
    });
    await watcherInstance._testOnlyParcelSubscription;

    await watcherInstance.dispose();

    expect(fakeSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    watcherInstance = null;
  });

  it('should unsubscribe if disposed before subscription completes', async () => {
    let resolveSubscription!: (sub: watcher.AsyncSubscription) => void;
    const subscriptionPromise = new Promise<watcher.AsyncSubscription>(
      (resolve) => {
        resolveSubscription = resolve;
      },
    );
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };

    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async () => subscriptionPromise,
    });

    const disposePromise = watcherInstance.dispose();
    resolveSubscription(fakeSubscription);
    await disposePromise;

    expect(fakeSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    watcherInstance = null;
  });

  it('should notify subscribers with undefined once the watcher is ready', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    await watcherInstance._testOnlyParcelSubscription;
    expect(deltas).toEqual([undefined]);
  });

  it('should log an error when unsubscribe fails during dispose', async () => {
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine
        .createSpy('unsubscribe')
        .and.rejectWith(new Error('Failed to stop native watcher')),
    };
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async () => fakeSubscription,
    });
    await watcherInstance._testOnlyParcelSubscription;

    await watcherInstance.dispose();

    expect(
      logs().messages.some(
        (msg) =>
          msg[0] === 'ERROR' &&
          String(msg[1]).includes(
            'FileSystemWatcher failed to unsubscribe: Failed to stop native watcher',
          ),
      ),
    ).toBe(true);
    watcherInstance = null;
  });

  it('should allow disposing a subscription multiple times safely', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    const subscription = watcherInstance.subscribe((d) => deltas.push(d));

    expect(() => {
      subscription.dispose();
      subscription.dispose();
    }).not.toThrow();

    const filePath = path.join(tmpDir, 'disposed.txt');
    fs.writeFileSync(filePath, 'hello');

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(deltas.length).toBe(0);
  });

  it('should continue notifying remaining subscribers when one subscriber disposes', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas1: Array<SnapshotDelta | undefined> = [];
    const deltas2: Array<SnapshotDelta | undefined> = [];
    const sub1 = watcherInstance.subscribe((d) => deltas1.push(d));
    watcherInstance.subscribe((d) => deltas2.push(d));

    sub1.dispose();

    const filePath = path.join(tmpDir, 'remaining.txt');
    fs.writeFileSync(filePath, 'content');

    const delta2 = await waitForSnapshot(deltas2, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === filePath),
    );

    expect(delta2).toBeDefined();
    expect(deltas1.length).toBe(0);
  });

  it('should allow calling dispose on the watcher multiple times safely', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance._testOnlyParcelSubscription;

    await watcherInstance.dispose();
    await expectAsync(watcherInstance.dispose()).toBeResolved();
    watcherInstance = null;
  });

  it('should log an error and notify subscribers with undefined when watcher emits an error', async () => {
    let capturedCallback!: watcher.SubscribeCallback;
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };
    const overrideSubscribeForTests = jasmine
      .createSpy('overrideSubscribeForTests')
      .and.callFake(async (_path: string, cb: watcher.SubscribeCallback) => {
        capturedCallback = cb;
        return fakeSubscription;
      });

    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    // Simulate @parcel/watcher calling the event callback with an error
    const testError = new Error('Simulated OS watch error');
    capturedCallback(testError, []);

    expect(
      logs().messages.some(
        (msg) =>
          msg[0] === 'ERROR' &&
          String(msg[1]).includes(
            'FileSystemWatcher error: Simulated OS watch error',
          ),
      ),
    ).toBe(true);

    expect(deltas).toEqual([undefined]);
  });
});
