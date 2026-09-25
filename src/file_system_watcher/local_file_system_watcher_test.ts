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
import {installVscode, logs} from '../testing/install_vscode';
import {LocalFileSystemWatcher} from './local_file_system_watcher';
import {FileChangeType, SnapshotDelta} from './file_system_watcher';
import {OutputChannelLogger} from '../logging/output_channel_logger';
import {setGlobalLogger, removeGlobalLogger} from '../logging/logging';

function waitForSnapshot(
  receivedDeltas: Array<SnapshotDelta | undefined>,
  predicate: (delta: SnapshotDelta) => boolean,
  timeoutMs = 3000,
): Promise<SnapshotDelta> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const found = receivedDeltas.find(
        (d): d is SnapshotDelta => d !== undefined && predicate(d),
      );
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
    }, 10);
  });
}

describe('LocalFileSystemWatcher (Integration with @parcel/watcher)', () => {
  let tmpDir: string;
  let watcherInstance: LocalFileSystemWatcher | null = null;
  let secondWatcherInstance: LocalFileSystemWatcher | null = null;

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
    if (secondWatcherInstance) {
      await secondWatcherInstance.dispose();
      secondWatcherInstance = null;
    }
    fs.rmSync(tmpDir, {recursive: true, force: true});
    removeGlobalLogger();
  });

  it('should notify subscribers with ADDED when a new file is created', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance.init();

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'new_file.txt');
    fs.writeFileSync(filePath, 'hello world');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.uri.fsPath === filePath && c.type === FileChangeType.ADDED,
      ),
    );

    expect(delta.snapshotVersion).toBeGreaterThan(0);
    expect(delta.stateChanged).toBe(false);
  });

  it('should notify subscribers with MODIFIED when an existing file is updated', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance.init();

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
    await watcherInstance.init();

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
    await watcherInstance.init();

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
    await watcherInstance.init();

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
    await watcherInstance.init();

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
    await watcherInstance.init();

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
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance.init();

    secondWatcherInstance = new LocalFileSystemWatcher(tmpDir);
    await secondWatcherInstance.init();

    const deltas: Array<SnapshotDelta | undefined> = [];
    const subscription = watcherInstance.subscribe((d) => deltas.push(d));

    const secondDeltas: Array<SnapshotDelta | undefined> = [];
    secondWatcherInstance.subscribe((d) => secondDeltas.push(d));

    const file1 = path.join(tmpDir, 'file1.txt');
    fs.writeFileSync(file1, '1');

    await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === file1),
    );

    subscription.dispose();
    const countBefore = deltas.length;

    const file2 = path.join(tmpDir, 'file2.txt');
    fs.writeFileSync(file2, '2');

    // Ensure the second watcher has received the update.
    await waitForSnapshot(secondDeltas, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === file2),
    );

    expect(deltas.length).toBe(countBefore);
  });

  it('should isolate subscriber errors so other subscribers still receive updates', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance.init();

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
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    await watcherInstance.init();

    secondWatcherInstance = new LocalFileSystemWatcher(tmpDir);
    await secondWatcherInstance.init();

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const secondDeltas: Array<SnapshotDelta | undefined> = [];
    secondWatcherInstance.subscribe((d) => secondDeltas.push(d));

    await watcherInstance.dispose();
    watcherInstance = null;

    const filePath = path.join(tmpDir, 'after_dispose.txt');
    fs.writeFileSync(filePath, 'should be ignored');

    // Ensure the second watcher has received the update.
    await waitForSnapshot(secondDeltas, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === filePath),
    );

    expect(deltas.length).toBe(0);
  });

  it('should unsubscribe if disposed before init completes', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);
    const disposeSpy = spyOn(watcherInstance, 'dispose').and.callThrough();

    secondWatcherInstance = new LocalFileSystemWatcher(tmpDir);
    await secondWatcherInstance.init();

    const initPromise = watcherInstance.init();

    // Dispose while watcher.subscribe is still pending.
    await watcherInstance.dispose();
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    // Wait for init() to finish, which should trigger the `if (this.isDisposed)`
    // check and call dispose() again to unsubscribe.
    await initPromise;
    expect(disposeSpy).toHaveBeenCalledTimes(2);

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const secondDeltas: Array<SnapshotDelta | undefined> = [];
    secondWatcherInstance.subscribe((d) => secondDeltas.push(d));

    const filePath = path.join(tmpDir, 'after_early_dispose.txt');
    fs.writeFileSync(filePath, 'should be ignored');

    // Ensure the second watcher has received the update.
    await waitForSnapshot(secondDeltas, (d) =>
      d.fileChanges.some((c) => c.uri.fsPath === filePath),
    );

    expect(deltas.length).toBe(0);
  });

  it('should throw an error when subscribe is called before init', () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir);

    expect(() => {
      watcherInstance!.subscribe(() => {});
    }).toThrowError(
      /Programming error: init\(\) is not called before subscribe/,
    );
  });
});
