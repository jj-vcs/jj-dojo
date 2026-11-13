/**
 * @license
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
import {newRepo} from '../testing/new_repo';
import {SubprocessClient} from '../client/subprocess_client';
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

function waitForCondition(
  predicate: () => boolean,
  description: string,
): Promise<void> {
  const timeoutMs = 30000;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for condition: ${description}`));
      }
    }, 50);
  });
}

describe('LocalFileSystemWatcher (Integration with @parcel/watcher)', () => {
  let tmpDir: string;
  let fakeHomeDir: string;
  let watcherInstance: LocalFileSystemWatcher | null = null;

  beforeEach(() => {
    installVscode();
    const logger = new OutputChannelLogger();
    setGlobalLogger(logger);
    tmpDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'local-fs-watcher-test-')),
    );
    fakeHomeDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'local-fs-watcher-home-')),
    );
  });

  afterEach(async () => {
    if (watcherInstance) {
      await watcherInstance.dispose();
      watcherInstance = null;
    }
    fs.rmSync(tmpDir, {recursive: true, force: true});
    fs.rmSync(fakeHomeDir, {recursive: true, force: true});
    removeGlobalLogger();
  });

  it('should notify subscribers with ADDED when a new file is created', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'new_file.txt');
    fs.writeFileSync(filePath, 'hello world');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.path === 'new_file.txt' && c.type === FileChangeType.ADDED,
      ),
    );

    expect(delta.snapshotNumber).toBeGreaterThan(0);
    expect(delta.stateChanged).toBe(false);
  });

  it('should notify subscribers with MODIFIED when an existing file is updated', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'existing_file.txt');
    fs.writeFileSync(filePath, 'initial content');

    await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) =>
          c.path === 'existing_file.txt' && c.type === FileChangeType.ADDED,
      ),
    );

    fs.writeFileSync(filePath, 'updated content');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) =>
          c.path === 'existing_file.txt' && c.type === FileChangeType.MODIFIED,
      ),
    );

    expect(delta.stateChanged).toBe(false);
  });

  it('should notify subscribers with DELETED when a file is deleted', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'to_delete.txt');
    fs.writeFileSync(filePath, 'delete me');

    await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.path === 'to_delete.txt' && c.type === FileChangeType.ADDED,
      ),
    );

    fs.unlinkSync(filePath);

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.path === 'to_delete.txt' && c.type === FileChangeType.DELETED,
      ),
    );

    expect(delta.stateChanged).toBe(false);
  });

  it('should set stateChanged to true and strip .jj paths when .jj/working_copy/checkout changes', async () => {
    const jjDir = path.join(tmpDir, '.jj', 'working_copy');
    fs.mkdirSync(jjDir, {recursive: true});

    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const checkoutPath = path.join(jjDir, 'checkout');
    fs.writeFileSync(checkoutPath, 'commit-xyz');

    const delta = await waitForSnapshot(deltas, (d) => d.stateChanged);

    expect(delta.stateChanged).toBe(true);
    expect(delta.fileChanges).toEqual([]);
  });

  it('should ignore nested workspace .jj checkout changes without setting stateChanged', async () => {
    const nestedJjDir = path.join(tmpDir, 'nested_repo', '.jj', 'working_copy');
    fs.mkdirSync(nestedJjDir, {recursive: true});

    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const nestedCheckoutPath = path.join(nestedJjDir, 'checkout');
    fs.writeFileSync(nestedCheckoutPath, 'commit-nested');

    // Write a tracked marker file afterwards to flush the watcher queue and
    // verify nested .jj paths neither set stateChanged nor appear in deltas.
    await new Promise((resolve) => setTimeout(resolve, 50));
    fs.writeFileSync(path.join(tmpDir, 'marker.txt'), 'visible');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some((c) => c.path === 'marker.txt'),
    );

    expect(delta.stateChanged).toBe(false);
    expect(delta.snapshotNumber).toBe(1);
    for (const received of deltas) {
      if (!received) {
        continue;
      }
      expect(received.stateChanged).toBe(false);
      expect(received.fileChanges.some((c) => c.path.includes('.jj'))).toBe(
        false,
      );
    }
  });

  it('should not set stateChanged to true when foo.jj/working_copy/checkout changes', async () => {
    const fakeJjDir = path.join(tmpDir, 'foo.jj', 'working_copy');
    fs.mkdirSync(fakeJjDir, {recursive: true});

    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const fakeCheckoutPath = path.join(fakeJjDir, 'checkout');
    fs.writeFileSync(fakeCheckoutPath, 'commit-fake');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some((c) => c.path === 'foo.jj/working_copy/checkout'),
    );

    expect(delta.stateChanged).toBe(false);
  });

  it('should notify multiple subscribers independently', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas1: Array<SnapshotDelta | undefined> = [];
    const deltas2: Array<SnapshotDelta | undefined> = [];

    watcherInstance.subscribe((d) => deltas1.push(d));
    watcherInstance.subscribe((d) => deltas2.push(d));

    const filePath = path.join(tmpDir, 'shared.txt');
    fs.writeFileSync(filePath, 'shared content');

    const delta1 = await waitForSnapshot(deltas1, (d) =>
      d.fileChanges.some((c) => c.path === 'shared.txt'),
    );
    const delta2 = await waitForSnapshot(deltas2, (d) =>
      d.fileChanges.some((c) => c.path === 'shared.txt'),
    );

    const change1 = delta1.fileChanges.find((c) => c.path === 'shared.txt');
    const change2 = delta2.fileChanges.find((c) => c.path === 'shared.txt');
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
      envForTests: {},
      homeDirForTests: fakeHomeDir,
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
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe(() => {
      throw new Error('Subscriber error simulation');
    });
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'resilient.txt');
    fs.writeFileSync(filePath, 'resilient content');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some((c) => c.path === 'resilient.txt'),
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
      envForTests: {},
      homeDirForTests: fakeHomeDir,
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
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });

    const disposePromise = watcherInstance.dispose();
    resolveSubscription(fakeSubscription);
    await disposePromise;

    expect(fakeSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    watcherInstance = null;
  });

  it('should notify subscribers with undefined once the watcher is ready', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });

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
      envForTests: {},
      homeDirForTests: fakeHomeDir,
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
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
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
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas1: Array<SnapshotDelta | undefined> = [];
    const deltas2: Array<SnapshotDelta | undefined> = [];
    const sub1 = watcherInstance.subscribe((d) => deltas1.push(d));
    watcherInstance.subscribe((d) => deltas2.push(d));

    sub1.dispose();

    const filePath = path.join(tmpDir, 'remaining.txt');
    fs.writeFileSync(filePath, 'content');

    const delta2 = await waitForSnapshot(deltas2, (d) =>
      d.fileChanges.some((c) => c.path === 'remaining.txt'),
    );

    expect(delta2).toBeDefined();
    expect(deltas1.length).toBe(0);
  });

  it('should allow calling dispose on the watcher multiple times safely', async () => {
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
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
      envForTests: {},
      homeDirForTests: fakeHomeDir,
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

  it('should throw an error when initialized with a non-absolute path', () => {
    expect(() => new LocalFileSystemWatcher('relative/path')).toThrow();
    expect(
      logs().messages.some(
        (msg) =>
          msg[0] === 'ERROR' &&
          String(msg[1]).includes(
            'LocalFileSystemWatcher received non-absolute path: relative/path',
          ),
      ),
    ).toBe(true);
  });

  it('should handle paths with a trailing slash', async () => {
    const dirWithTrailingSlash = tmpDir + path.sep;
    watcherInstance = new LocalFileSystemWatcher(dirWithTrailingSlash, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const filePath = path.join(tmpDir, 'file_in_trailing_slash_dir.txt');
    fs.writeFileSync(filePath, 'hello');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) =>
          c.path === 'file_in_trailing_slash_dir.txt' &&
          c.type === FileChangeType.ADDED,
      ),
    );

    expect(delta).toBeDefined();
    expect(delta.stateChanged).toBe(false);
  });

  it('should watch a symlinked directory and receive file change events', async () => {
    const realDir = path.join(tmpDir, 'real_repo');
    fs.mkdirSync(realDir);
    const symlinkDir = path.join(tmpDir, 'symlink_repo');
    fs.symlinkSync(realDir, symlinkDir, 'dir');

    watcherInstance = new LocalFileSystemWatcher(symlinkDir, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    const symlinkFilePath = path.join(symlinkDir, 'new_file.txt');
    fs.writeFileSync(symlinkFilePath, 'hello symlink');

    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.path === 'new_file.txt' && c.type === FileChangeType.ADDED,
      ),
    );

    expect(delta).toBeDefined();
    expect(delta.stateChanged).toBe(false);
  });

  it('should pass native opts.ignore for .git, .jj/repo dir, and un-negated top-level ignored dirs while omitting existing non-directories for dir-only rules', async () => {
    fs.mkdirSync(path.join(tmpDir, '.jj', 'repo'), {recursive: true});
    fs.mkdirSync(path.join(tmpDir, 'node_modules'), {recursive: true});
    // `build/` and `symlink_dir/` are directory-only rules, but `build` is a
    // tracked regular file and `symlink_dir` is a symlink at root: neither
    // should be passed to @parcel/watcher opts.ignore.
    fs.writeFileSync(path.join(tmpDir, 'build'), '#!/bin/sh\necho build\n');
    const symlinkTargetDir = path.join(fakeHomeDir, 'ext_target_dir');
    fs.mkdirSync(symlinkTargetDir, {recursive: true});
    fs.symlinkSync(symlinkTargetDir, path.join(tmpDir, 'symlink_dir'), 'dir');
    // `/out` is NOT directory-only (`matchesFile('out') === true`), so it stays
    // in native opts.ignore even when a regular file exists at `<tmpDir>/out`.
    fs.writeFileSync(path.join(tmpDir, 'out'), 'ignored file');
    fs.writeFileSync(
      path.join(tmpDir, '.gitignore'),
      'node_modules/\n/dist/\nbuild/\nsymlink_dir/\n/out\n*.log\nkept/\n!kept/\n',
    );

    let capturedOptions: watcher.Options | undefined;
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };

    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, _cb, opts) => {
        capturedOptions = opts;
        return fakeSubscription;
      },
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    expect(capturedOptions?.ignore).toEqual([
      '.git',
      '.jj/repo',
      'dist',
      'node_modules',
      'out',
    ]);
    watcherInstance = null;
  });

  it('should omit .jj/repo from native opts.ignore when .jj/repo is a workspace pointer file', async () => {
    fs.mkdirSync(path.join(tmpDir, '.jj'), {recursive: true});
    fs.writeFileSync(path.join(tmpDir, '.jj', 'repo'), '../primary/.jj/repo');

    let capturedOptions: watcher.Options | undefined;
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };

    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, _cb, opts) => {
        capturedOptions = opts;
        return fakeSubscription;
      },
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    expect(capturedOptions?.ignore).toEqual(['.git']);
    watcherInstance = null;
  });

  it('should natively exclude .git, .jj/repo, and top-level ignored dirs in @parcel/watcher while watching checkout and symlinked workspaces', async () => {
    const realRepo = path.join(tmpDir, 'real_ws');
    fs.mkdirSync(path.join(realRepo, '.git', 'objects'), {recursive: true});
    fs.mkdirSync(path.join(realRepo, '.jj', 'repo', 'op_store'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(realRepo, '.jj', 'working_copy'), {recursive: true});
    fs.mkdirSync(path.join(realRepo, 'node_modules', 'pkg'), {recursive: true});
    fs.writeFileSync(path.join(realRepo, '.gitignore'), 'node_modules/\n');

    const symlinkRepo = path.join(tmpDir, 'symlink_ws');
    fs.symlinkSync(realRepo, symlinkRepo, 'dir');

    watcherInstance = new LocalFileSystemWatcher(symlinkRepo, {
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    // Write to natively excluded directories and working_copy.lock.
    fs.writeFileSync(path.join(realRepo, '.git', 'objects', 'obj1'), 'git-obj');
    fs.writeFileSync(
      path.join(realRepo, '.jj', 'repo', 'op_store', 'op1'),
      'jj-op',
    );
    fs.writeFileSync(
      path.join(realRepo, '.jj', 'working_copy', 'working_copy.lock'),
      'lock',
    );
    fs.writeFileSync(
      path.join(realRepo, 'node_modules', 'pkg', 'index.js'),
      'ignored-dep',
    );

    // Trigger checkout change and a tracked file edit.
    fs.writeFileSync(
      path.join(realRepo, '.jj', 'working_copy', 'checkout'),
      'wc-state-2',
    );
    await waitForSnapshot(deltas, (d) => d.stateChanged);

    fs.writeFileSync(path.join(symlinkRepo, 'src.ts'), 'export const x = 1;');
    const fileDelta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some((c) => c.path === 'src.ts'),
    );

    expect(fileDelta.fileChanges).toEqual([
      {path: 'src.ts', type: FileChangeType.ADDED},
    ]);
    for (const d of deltas) {
      if (!d) {
        continue;
      }
      for (const change of d.fileChanges) {
        expect(change.path.startsWith('node_modules')).toBe(false);
        expect(change.path.includes('.jj')).toBe(false);
        expect(change.path.includes('.git')).toBe(false);
      }
    }
  });

  it('should suppress empty deltas and not increment snapshotNumber when all events are VCS internals or gitignored', async () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '*.log\n');

    let capturedCallback!: watcher.SubscribeCallback;
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, cb) => {
        capturedCallback = cb;
        return fakeSubscription;
      },
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    capturedCallback(null, [
      {
        path: path.join(tmpDir, '.jj', 'working_copy', 'working_copy.lock'),
        type: 'create',
      },
      {path: path.join(tmpDir, '.git', 'index.lock'), type: 'create'},
      {path: path.join(tmpDir, 'debug.log'), type: 'create'},
    ]);

    expect(deltas).toEqual([]);

    capturedCallback(null, [
      {path: path.join(tmpDir, 'tracked.ts'), type: 'create'},
    ]);

    expect(deltas.length).toBe(1);
    expect(deltas[0]).toEqual({
      stateChanged: false,
      snapshotNumber: 1,
      fileChanges: [{path: 'tracked.ts', type: FileChangeType.ADDED}],
    });
    watcherInstance = null;
  });

  it('should apply root and nested .gitignore rules, ! negations, and directory-only rules', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), {recursive: true});
    fs.mkdirSync(path.join(tmpDir, 'docs'), {recursive: true});
    fs.mkdirSync(path.join(tmpDir, 'ignored_dir', 'nested'), {recursive: true});
    fs.mkdirSync(path.join(tmpDir, 'sub_with_file'), {recursive: true});

    fs.writeFileSync(
      path.join(tmpDir, '.gitignore'),
      ['*.log', '!important.log', '/root_only.tmp', 'ignored_dir/'].join('\n'),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'src', '.gitignore'),
      ['*.gen.ts', '!local_keep.log'].join('\n'),
    );
    // Negation inside an already-ignored parent directory cannot re-include files.
    fs.writeFileSync(
      path.join(tmpDir, 'ignored_dir', '.gitignore'),
      '!*\n!rescued.txt\n',
    );
    // Regular file named `ignored_dir` must NOT match `ignored_dir/` directory-only rule.
    fs.writeFileSync(
      path.join(tmpDir, 'sub_with_file', 'ignored_dir'),
      'regular file',
    );

    let capturedCallback!: watcher.SubscribeCallback;
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, cb) => {
        capturedCallback = cb;
        return fakeSubscription;
      },
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    capturedCallback(null, [
      {path: path.join(tmpDir, 'app.log'), type: 'create'},
      {path: path.join(tmpDir, 'important.log'), type: 'create'},
      {path: path.join(tmpDir, 'root_only.tmp'), type: 'create'},
      {path: path.join(tmpDir, 'src', 'root_only.tmp'), type: 'create'},
      {path: path.join(tmpDir, 'src', 'api.gen.ts'), type: 'create'},
      {path: path.join(tmpDir, 'docs', 'api.gen.ts'), type: 'create'},
      {path: path.join(tmpDir, 'src', 'other.log'), type: 'create'},
      {path: path.join(tmpDir, 'src', 'local_keep.log'), type: 'create'},
      {path: path.join(tmpDir, 'ignored_dir'), type: 'create'},
      {
        path: path.join(tmpDir, 'ignored_dir', 'rescued.txt'),
        type: 'create',
      },
      {
        path: path.join(tmpDir, 'ignored_dir', 'important.log'),
        type: 'create',
      },
      {
        path: path.join(tmpDir, 'sub_with_file', 'ignored_dir'),
        type: 'create',
      },
    ]);

    expect(deltas.length).toBe(1);
    expect(deltas[0]?.fileChanges).toEqual([
      {path: 'important.log', type: FileChangeType.ADDED},
      {path: 'src/root_only.tmp', type: FileChangeType.ADDED},
      {path: 'docs/api.gen.ts', type: FileChangeType.ADDED},
      {path: 'src/local_keep.log', type: FileChangeType.ADDED},
      {path: 'sub_with_file/ignored_dir', type: FileChangeType.ADDED},
    ]);

    // Deleting the ignored directory and its children must also be ignored.
    fs.rmSync(path.join(tmpDir, 'ignored_dir'), {recursive: true, force: true});
    capturedCallback(null, [
      {path: path.join(tmpDir, 'ignored_dir'), type: 'delete'},
      {
        path: path.join(tmpDir, 'ignored_dir', 'nested', 'gone.txt'),
        type: 'delete',
      },
    ]);
    expect(deltas.length).toBe(1);

    // Deleting a non-ignored directory `src/` that had cached `src/.gitignore`
    // (`*.gen.ts`) must invalidate its cached rules so recreating `src/api.gen.ts`
    // without `src/.gitignore` emits the file change.
    fs.rmSync(path.join(tmpDir, 'src'), {recursive: true, force: true});
    capturedCallback(null, [{path: path.join(tmpDir, 'src'), type: 'delete'}]);
    expect(deltas.length).toBe(2);
    expect(deltas[1]?.fileChanges).toEqual([
      {path: 'src', type: FileChangeType.DELETED},
    ]);

    fs.mkdirSync(path.join(tmpDir, 'src'), {recursive: true});
    fs.writeFileSync(path.join(tmpDir, 'src', 'api.gen.ts'), 'export {};');
    capturedCallback(null, [
      {path: path.join(tmpDir, 'src', 'api.gen.ts'), type: 'create'},
    ]);
    expect(deltas.length).toBe(3);
    expect(deltas[2]?.fileChanges).toEqual([
      {path: 'src/api.gen.ts', type: FileChangeType.ADDED},
    ]);

    // Deleting a directory tracked in `knownDirs` (`ignored_dir`) and then
    // creating a regular file at that exact path under the `ignored_dir/`
    // directory-only rule must emit the regular file rather than treating it
    // as a directory.
    fs.writeFileSync(path.join(tmpDir, 'ignored_dir'), 'now a regular file');
    capturedCallback(null, [
      {path: path.join(tmpDir, 'ignored_dir'), type: 'create'},
    ]);
    expect(deltas.length).toBe(4);
    expect(deltas[3]?.fileChanges).toEqual([
      {path: 'ignored_dir', type: FileChangeType.ADDED},
    ]);
    // Deleting that regular file must also not be treated as a directory delete.
    fs.unlinkSync(path.join(tmpDir, 'ignored_dir'));
    capturedCallback(null, [
      {path: path.join(tmpDir, 'ignored_dir'), type: 'delete'},
    ]);
    expect(deltas.length).toBe(5);
    expect(deltas[4]?.fileChanges).toEqual([
      {path: 'ignored_dir', type: FileChangeType.DELETED},
    ]);
    watcherInstance = null;
  });

  it('should ignore symlinked .gitignore files in the working copy', async () => {
    const externalRules = path.join(fakeHomeDir, 'external_rules');
    fs.writeFileSync(externalRules, '*.secret\n');
    fs.symlinkSync(externalRules, path.join(tmpDir, '.gitignore'));

    fs.mkdirSync(path.join(tmpDir, 'sub'));
    fs.symlinkSync(externalRules, path.join(tmpDir, 'sub', '.gitignore'));

    let capturedCallback!: watcher.SubscribeCallback;
    const fakeSubscription: watcher.AsyncSubscription = {
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };
    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, cb) => {
        capturedCallback = cb;
        return fakeSubscription;
      },
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    capturedCallback(null, [
      {path: path.join(tmpDir, 'top.secret'), type: 'create'},
      {path: path.join(tmpDir, 'sub', 'nested.secret'), type: 'create'},
    ]);

    expect(deltas.length).toBe(1);
    expect(deltas[0]?.fileChanges).toEqual([
      {path: 'top.secret', type: FileChangeType.ADDED},
      {path: 'sub/nested.secret', type: FileChangeType.ADDED},
    ]);
    watcherInstance = null;
  });

  it('should dynamically reload .gitignore rules and re-subscribe when top-level native ignores change', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sub'), {recursive: true});
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '*.tmp\n');

    const callbacks: watcher.SubscribeCallback[] = [];
    const optionsHistory: Array<watcher.Options | undefined> = [];
    const unsubscribeSpies: jasmine.Spy[] = [];

    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, cb, opts) => {
        callbacks.push(cb);
        optionsHistory.push(opts);
        const spy = jasmine
          .createSpy(`unsubscribe-${callbacks.length}`)
          .and.resolveTo();
        unsubscribeSpies.push(spy);
        return {unsubscribe: spy};
      },
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    expect(optionsHistory.length).toBe(1);
    expect(optionsHistory[0]?.ignore).toEqual(['.git']);

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    // Edit root .gitignore with only a file pattern (*.bak) in the SAME batch
    // where foo.bak appears BEFORE .gitignore; should invalidate first without
    // re-subscribing @parcel/watcher.
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '*.tmp\n*.bak\n');
    callbacks[0](null, [
      {path: path.join(tmpDir, 'foo.bak'), type: 'create'},
      {path: path.join(tmpDir, '.gitignore'), type: 'update'},
    ]);

    expect(optionsHistory.length).toBe(1);
    expect(deltas.length).toBe(1);
    expect(deltas[0]?.fileChanges).toEqual([
      {path: '.gitignore', type: FileChangeType.MODIFIED},
    ]);

    // Add nested sub/.gitignore dynamically and verify cache invalidation.
    fs.writeFileSync(path.join(tmpDir, 'sub', '.gitignore'), '*.local\n');
    callbacks[0](null, [
      {path: path.join(tmpDir, 'sub', 'ignored.local'), type: 'create'},
      {path: path.join(tmpDir, 'sub', '.gitignore'), type: 'create'},
    ]);
    expect(deltas.length).toBe(2);
    expect(deltas[1]?.fileChanges).toEqual([
      {path: 'sub/.gitignore', type: FileChangeType.ADDED},
    ]);

    // Edit root .gitignore to add a top-level directory `artifacts/` ->
    // must unsubscribe subscription 1, subscribe subscription 2 with updated
    // opts.ignore, and notify undefined once ready.
    fs.writeFileSync(
      path.join(tmpDir, '.gitignore'),
      '*.tmp\n*.bak\nartifacts/\n',
    );
    callbacks[0](null, [
      {path: path.join(tmpDir, '.gitignore'), type: 'update'},
    ]);

    await waitForCondition(
      () => callbacks.length === 2 && deltas.includes(undefined),
      're-subscription to complete and emit undefined',
    );
    await watcherInstance._testOnlyParcelSubscription;

    expect(unsubscribeSpies[0]).toHaveBeenCalledTimes(1);
    expect(optionsHistory[1]?.ignore).toEqual(['.git', 'artifacts']);

    // Stale events from superseded callback[0] must be ignored.
    const countBeforeStale = deltas.length;
    callbacks[0](null, [
      {path: path.join(tmpDir, 'stale.txt'), type: 'create'},
    ]);
    expect(deltas.length).toBe(countBeforeStale);

    // Events from active callback[1] are delivered.
    callbacks[1](null, [
      {path: path.join(tmpDir, 'fresh.txt'), type: 'create'},
    ]);
    expect(deltas[deltas.length - 1]).toEqual({
      stateChanged: false,
      snapshotNumber: 4,
      fileChanges: [{path: 'fresh.txt', type: FileChangeType.ADDED}],
    });

    // Edit root .gitignore to REMOVE `artifacts/` -> must unsubscribe
    // subscription 2 and re-subscribe subscription 3 without `artifacts`.
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '*.tmp\n*.bak\n');
    callbacks[1](null, [
      {path: path.join(tmpDir, '.gitignore'), type: 'update'},
    ]);

    await waitForCondition(
      () => callbacks.length === 3,
      're-subscription after removing top-level ignored dir',
    );
    await watcherInstance._testOnlyParcelSubscription;

    expect(unsubscribeSpies[1]).toHaveBeenCalledTimes(1);
    expect(optionsHistory[2]?.ignore).toEqual(['.git']);

    await watcherInstance.dispose();
    expect(unsubscribeSpies[2]).toHaveBeenCalledTimes(1);
    watcherInstance = null;
  });

  it('should reconcile .gitignore changes occurring during async subscribe windows and watcher overflow errors', async () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '*.initial\n');

    const callbacks: watcher.SubscribeCallback[] = [];
    const optionsHistory: Array<watcher.Options | undefined> = [];
    const unsubscribeSpies: jasmine.Spy[] = [];
    let mutatedDuringInitialSubscribe = false;

    watcherInstance = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, cb, opts) => {
        callbacks.push(cb);
        optionsHistory.push(opts);
        const spy = jasmine
          .createSpy(`unsubscribe-race-${callbacks.length}`)
          .and.resolveTo();
        unsubscribeSpies.push(spy);
        if (!mutatedDuringInitialSubscribe) {
          mutatedDuringInitialSubscribe = true;
          // Simulate root .gitignore changing on disk while the first OS
          // subscription is still in flight.
          fs.writeFileSync(
            path.join(tmpDir, '.gitignore'),
            '*.initial\n*.during-sub\nadded_during_sub/\n',
          );
        }
        return {unsubscribe: spy};
      },
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await watcherInstance._testOnlyParcelSubscription;

    // First subscription had stale opts.ignore (['.git']) and must have been
    // replaced immediately by a second subscription with ['added_during_sub'].
    expect(callbacks.length).toBe(2);
    expect(unsubscribeSpies[0]).toHaveBeenCalledTimes(1);
    expect(optionsHistory[0]?.ignore).toEqual(['.git']);
    expect(optionsHistory[1]?.ignore).toEqual(['.git', 'added_during_sub']);

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    // File rules added during the subscribe window (`*.during-sub`) must also
    // be active in the reset cache.
    callbacks[1](null, [
      {path: path.join(tmpDir, 'skip.during-sub'), type: 'create'},
      {path: path.join(tmpDir, 'kept.txt'), type: 'create'},
    ]);
    expect(deltas.length).toBe(1);
    expect(deltas[0]?.fileChanges).toEqual([
      {path: 'kept.txt', type: FileChangeType.ADDED},
    ]);

    // Now simulate an OS watcher queue overflow error where a nested
    // .gitignore and root .gitignore changed while kernel events were dropped.
    fs.mkdirSync(path.join(tmpDir, 'sub'), {recursive: true});
    fs.writeFileSync(
      path.join(tmpDir, 'sub', '.gitignore'),
      '*.overflow-sub\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, '.gitignore'),
      '*.initial\n*.during-sub\nadded_during_sub/\noverflow_dir/\n',
    );
    callbacks[1](new Error('IN_Q_OVERFLOW'), []);

    await waitForCondition(
      () => callbacks.length === 3 && deltas.includes(undefined),
      'watcher error recovery re-subscription',
    );
    await watcherInstance._testOnlyParcelSubscription;
    expect(unsubscribeSpies[1]).toHaveBeenCalledTimes(1);
    expect(optionsHistory[2]?.ignore).toEqual([
      '.git',
      'added_during_sub',
      'overflow_dir',
    ]);

    callbacks[2](null, [
      {path: path.join(tmpDir, 'sub', 'drop.overflow-sub'), type: 'create'},
      {path: path.join(tmpDir, 'sub', 'pass.txt'), type: 'create'},
    ]);
    expect(deltas[deltas.length - 1]?.fileChanges).toEqual([
      {path: 'sub/pass.txt', type: FileChangeType.ADDED},
    ]);

    await watcherInstance.dispose();
    watcherInstance = null;
  });

  it('should respect .git/info/exclude in colocated, git_target, and secondary workspace layouts', async () => {
    // Layout 1: Colocated .git/info/exclude
    const colocatedDir = path.join(tmpDir, 'colocated');
    fs.mkdirSync(path.join(colocatedDir, '.git', 'info'), {recursive: true});
    fs.writeFileSync(
      path.join(colocatedDir, '.git', 'info', 'exclude'),
      '*.colocated-ignored\n',
    );

    let cb1!: watcher.SubscribeCallback;
    const w1 = new LocalFileSystemWatcher(colocatedDir, {
      overrideSubscribeForTests: async (_dir, cb) => {
        cb1 = cb;
        return {unsubscribe: async () => {}};
      },
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await w1._testOnlyParcelSubscription;
    const deltas1: Array<SnapshotDelta | undefined> = [];
    w1.subscribe((d) => deltas1.push(d));
    cb1(null, [
      {path: path.join(colocatedDir, 'skip.colocated-ignored'), type: 'create'},
      {path: path.join(colocatedDir, 'keep.txt'), type: 'create'},
    ]);
    expect(deltas1.length).toBe(1);
    expect(deltas1[0]?.fileChanges).toEqual([
      {path: 'keep.txt', type: FileChangeType.ADDED},
    ]);
    await w1.dispose();

    // Layout 2: Non-colocated Jujutsu repo with .jj/repo/store/git_target
    // Layout 3: Secondary Jujutsu workspace with .jj/repo pointer file
    const primaryDir = path.join(tmpDir, 'primary_ws');
    const internalGitDir = path.join(primaryDir, '.jj', 'repo', 'store', 'git');
    fs.mkdirSync(path.join(internalGitDir, 'info'), {recursive: true});
    fs.writeFileSync(
      path.join(primaryDir, '.jj', 'repo', 'store', 'git_target'),
      'git',
    );
    fs.writeFileSync(
      path.join(internalGitDir, 'info', 'exclude'),
      '*.jj-exclude\n',
    );

    const secondaryDir = path.join(tmpDir, 'secondary_ws');
    fs.mkdirSync(path.join(secondaryDir, '.jj'), {recursive: true});
    fs.writeFileSync(
      path.join(secondaryDir, '.jj', 'repo'),
      '../../primary_ws/.jj/repo',
    );

    for (const wsDir of [primaryDir, secondaryDir]) {
      let cb!: watcher.SubscribeCallback;
      const wsWatcher = new LocalFileSystemWatcher(wsDir, {
        overrideSubscribeForTests: async (_dir, callback) => {
          cb = callback;
          return {unsubscribe: async () => {}};
        },
        envForTests: {},
        homeDirForTests: fakeHomeDir,
      });
      await wsWatcher._testOnlyParcelSubscription;
      const wsDeltas: Array<SnapshotDelta | undefined> = [];
      wsWatcher.subscribe((d) => wsDeltas.push(d));

      cb(null, [
        {path: path.join(wsDir, 'secret.jj-exclude'), type: 'create'},
        {path: path.join(wsDir, 'visible.rs'), type: 'create'},
      ]);

      expect(wsDeltas.length).toBe(1);
      expect(wsDeltas[0]?.fileChanges).toEqual([
        {path: 'visible.rs', type: FileChangeType.ADDED},
      ]);
      await wsWatcher.dispose();
    }

    // Layout 4: Linked Git worktree where `.git` is a `gitdir:` pointer file
    // and `<worktree_gitdir>/commondir` points to the shared Git directory.
    // Also verify `<worktree_gitdir>/config` is ignored in favor of
    // `<commonDir>/config` per gitrepository-layout(5).
    const sharedGitDir = path.join(tmpDir, 'shared_git');
    const worktreeGitDir = path.join(sharedGitDir, 'worktrees', 'wt1');
    const worktreeDir = path.join(tmpDir, 'linked_worktree');
    fs.mkdirSync(path.join(sharedGitDir, 'info'), {recursive: true});
    fs.mkdirSync(worktreeGitDir, {recursive: true});
    fs.mkdirSync(worktreeDir, {recursive: true});
    fs.writeFileSync(
      path.join(worktreeDir, '.git'),
      `gitdir: ${path.relative(worktreeDir, worktreeGitDir)}\n`,
    );
    fs.writeFileSync(path.join(worktreeGitDir, 'commondir'), '../..\n');
    fs.writeFileSync(
      path.join(sharedGitDir, 'info', 'exclude'),
      '*.worktree-common-exclude\n',
    );
    const commonConfiguredExcludes = path.join(
      fakeHomeDir,
      'common_config.ignore',
    );
    const staleWorktreeExcludes = path.join(
      fakeHomeDir,
      'stale_worktree.ignore',
    );
    fs.writeFileSync(commonConfiguredExcludes, '*.from-common-config\n');
    fs.writeFileSync(staleWorktreeExcludes, '*.from-stale-worktree-config\n');
    fs.writeFileSync(
      path.join(sharedGitDir, 'config'),
      `[core]\n\texcludesFile = ${commonConfiguredExcludes}\n`,
    );
    fs.writeFileSync(
      path.join(worktreeGitDir, 'config'),
      `[core]\n\texcludesFile = ${staleWorktreeExcludes}\n`,
    );

    let cbWt!: watcher.SubscribeCallback;
    const wtWatcher = new LocalFileSystemWatcher(worktreeDir, {
      overrideSubscribeForTests: async (_dir, cb) => {
        cbWt = cb;
        return {unsubscribe: async () => {}};
      },
      envForTests: {},
      homeDirForTests: fakeHomeDir,
    });
    await wtWatcher._testOnlyParcelSubscription;
    const wtDeltas: Array<SnapshotDelta | undefined> = [];
    wtWatcher.subscribe((d) => wtDeltas.push(d));
    cbWt(null, [
      {
        path: path.join(worktreeDir, 'a.worktree-common-exclude'),
        type: 'create',
      },
      {path: path.join(worktreeDir, 'b.from-common-config'), type: 'create'},
      {
        path: path.join(worktreeDir, 'c.from-stale-worktree-config'),
        type: 'create',
      },
    ]);
    expect(wtDeltas.length).toBe(1);
    expect(wtDeltas[0]?.fileChanges).toEqual([
      {
        path: 'c.from-stale-worktree-config',
        type: FileChangeType.ADDED,
      },
    ]);
    await wtWatcher.dispose();
  });

  it('should respect global Git excludes precedence, INI continuations/escapes, empty override, and live workspace-relative excludesFile edits', async () => {
    // 1. Default ~/.config/git/ignore when XDG_CONFIG_HOME is unset or empty.
    fs.mkdirSync(path.join(fakeHomeDir, '.config', 'git'), {recursive: true});
    fs.writeFileSync(
      path.join(fakeHomeDir, '.config', 'git', 'ignore'),
      '*.default-home-xdg\n',
    );

    let cbDefaultXdg!: watcher.SubscribeCallback;
    const defaultXdgWatcher = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, cb) => {
        cbDefaultXdg = cb;
        return {unsubscribe: async () => {}};
      },
      envForTests: {XDG_CONFIG_HOME: ''},
      homeDirForTests: fakeHomeDir,
    });
    await defaultXdgWatcher._testOnlyParcelSubscription;
    const defaultXdgDeltas: Array<SnapshotDelta | undefined> = [];
    defaultXdgWatcher.subscribe((d) => defaultXdgDeltas.push(d));
    cbDefaultXdg(null, [
      {path: path.join(tmpDir, 'drop.default-home-xdg'), type: 'create'},
      {path: path.join(tmpDir, 'keep.ts'), type: 'create'},
    ]);
    expect(defaultXdgDeltas.length).toBe(1);
    expect(defaultXdgDeltas[0]?.fileChanges).toEqual([
      {path: 'keep.ts', type: FileChangeType.ADDED},
    ]);
    await defaultXdgWatcher.dispose();

    // 2. XDG_CONFIG_HOME/git/config with inline `[core] excludesFile = ...`,
    // backslash line continuation, and string escapes (`\"`, `\\`, `\t`, `\n`, `\b`).
    const xdgDir = path.join(fakeHomeDir, 'custom_xdg');
    fs.mkdirSync(path.join(xdgDir, 'git'), {recursive: true});
    fs.writeFileSync(
      path.join(xdgDir, 'git', 'ignore'),
      '*.xdg-global-ignored\n',
    );
    const xdgConfiguredFile = path.join(fakeHomeDir, 'xdg_configured.ignore');
    fs.writeFileSync(xdgConfiguredFile, '*.from-xdg-config\n');
    fs.writeFileSync(
      path.join(xdgDir, 'git', 'config'),
      [
        '[core] excludesFile = "ignored_first_value_\\t\\n\\b\\\\\\"end"',
        '  excludesFile = \\',
        `    "${xdgConfiguredFile.replace(/\\/g, '\\\\')}" ; comment after quote`,
      ].join('\n'),
    );

    let cbXdgCfg!: watcher.SubscribeCallback;
    const xdgCfgWatcher = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, cb) => {
        cbXdgCfg = cb;
        return {unsubscribe: async () => {}};
      },
      envForTests: {XDG_CONFIG_HOME: xdgDir},
      homeDirForTests: fakeHomeDir,
    });
    await xdgCfgWatcher._testOnlyParcelSubscription;
    const xdgCfgDeltas: Array<SnapshotDelta | undefined> = [];
    xdgCfgWatcher.subscribe((d) => xdgCfgDeltas.push(d));
    cbXdgCfg(null, [
      {path: path.join(tmpDir, 'a.from-xdg-config'), type: 'create'},
      {path: path.join(tmpDir, 'b.xdg-global-ignored'), type: 'create'},
    ]);
    expect(xdgCfgDeltas.length).toBe(1);
    expect(xdgCfgDeltas[0]?.fileChanges).toEqual([
      {path: 'b.xdg-global-ignored', type: FileChangeType.ADDED},
    ]);
    await xdgCfgWatcher.dispose();

    // 3. ~/.gitconfig core.excludesFile = "" disables default/XDG excludes.
    fs.writeFileSync(
      path.join(fakeHomeDir, '.gitconfig'),
      '[core]\n  excludesFile =\n',
    );
    let cbEmptyCfg!: watcher.SubscribeCallback;
    const emptyCfgWatcher = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, cb) => {
        cbEmptyCfg = cb;
        return {unsubscribe: async () => {}};
      },
      envForTests: {XDG_CONFIG_HOME: xdgDir},
      homeDirForTests: fakeHomeDir,
    });
    await emptyCfgWatcher._testOnlyParcelSubscription;
    const emptyCfgDeltas: Array<SnapshotDelta | undefined> = [];
    emptyCfgWatcher.subscribe((d) => emptyCfgDeltas.push(d));
    cbEmptyCfg(null, [
      {path: path.join(tmpDir, 'a.from-xdg-config'), type: 'create'},
      {path: path.join(tmpDir, 'b.xdg-global-ignored'), type: 'create'},
    ]);
    expect(emptyCfgDeltas.length).toBe(1);
    expect(emptyCfgDeltas[0]?.fileChanges).toEqual([
      {path: 'a.from-xdg-config', type: FileChangeType.ADDED},
      {path: 'b.xdg-global-ignored', type: FileChangeType.ADDED},
    ]);
    await emptyCfgWatcher.dispose();

    // 4. <commonDir>/config overrides ~/.gitconfig and supports workspace-
    // relative `core.excludesFile` with live invalidation when edited.
    fs.writeFileSync(
      path.join(fakeHomeDir, '.my_global_gitignore'),
      '*.home-configured\n',
    );
    fs.writeFileSync(
      path.join(fakeHomeDir, '.gitconfig'),
      [
        '[core "unrelated"]',
        '  excludesFile = ~/wrong',
        '[Core]',
        '  excludesfile = "~/.my_global_gitignore" # inline comment',
      ].join('\n'),
    );
    fs.mkdirSync(path.join(tmpDir, '.git'), {recursive: true});
    fs.mkdirSync(path.join(tmpDir, 'config'), {recursive: true});
    const wsExcludesPath = path.join(tmpDir, 'config', 'ws.ignore');
    fs.writeFileSync(wsExcludesPath, '*.ws-rel-v1\n');
    fs.writeFileSync(
      path.join(tmpDir, '.git', 'config'),
      '[core]\n  excludesFile = config/ws.ignore\n',
    );

    let cbRepoCfg!: watcher.SubscribeCallback;
    const repoCfgWatcher = new LocalFileSystemWatcher(tmpDir, {
      overrideSubscribeForTests: async (_dir, cb) => {
        cbRepoCfg = cb;
        return {unsubscribe: async () => {}};
      },
      envForTests: {XDG_CONFIG_HOME: xdgDir},
      homeDirForTests: fakeHomeDir,
    });
    await repoCfgWatcher._testOnlyParcelSubscription;
    const repoCfgDeltas: Array<SnapshotDelta | undefined> = [];
    repoCfgWatcher.subscribe((d) => repoCfgDeltas.push(d));
    cbRepoCfg(null, [
      {path: path.join(tmpDir, 'skip.ws-rel-v1'), type: 'create'},
      {path: path.join(tmpDir, 'visible.home-configured'), type: 'create'},
    ]);
    expect(repoCfgDeltas.length).toBe(1);
    expect(repoCfgDeltas[0]?.fileChanges).toEqual([
      {path: 'visible.home-configured', type: FileChangeType.ADDED},
    ]);

    // Live edit to workspace-relative `config/ws.ignore` must invalidate
    // `baseIgnores` and filter events in the same batch using the new rules.
    fs.writeFileSync(wsExcludesPath, '*.ws-rel-v2\n');
    cbRepoCfg(null, [
      {path: path.join(tmpDir, 'now_ignored.ws-rel-v2'), type: 'create'},
      {path: wsExcludesPath, type: 'update'},
      {path: path.join(tmpDir, 'now_kept.ws-rel-v1'), type: 'create'},
    ]);
    expect(repoCfgDeltas.length).toBe(2);
    expect(repoCfgDeltas[1]?.fileChanges).toEqual([
      {path: 'config/ws.ignore', type: FileChangeType.MODIFIED},
      {path: 'now_kept.ws-rel-v1', type: FileChangeType.ADDED},
    ]);
    await repoCfgWatcher.dispose();
  });
});

describe('LocalFileSystemWatcher (Integration with real jj CLI)', () => {
  const {jj, repo, writeFile} = newRepo();
  let watcherInstance: LocalFileSystemWatcher | null = null;

  beforeEach(() => {
    installVscode();
    const logger = new OutputChannelLogger();
    setGlobalLogger(logger);
  });

  afterEach(async () => {
    if (watcherInstance) {
      await watcherInstance.dispose();
      watcherInstance = null;
    }
    removeGlobalLogger();
  });

  it('sets stateChanged to true when real jj CLI commands update the working copy checkout', async () => {
    watcherInstance = new LocalFileSystemWatcher(repo.workspaceRoot);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    await jj('new', '-m', 'second commit');
    const newCommitDelta = await waitForSnapshot(
      deltas,
      (d) => d.stateChanged === true,
    );
    expect(newCommitDelta.stateChanged).toBeTrue();

    deltas.length = 0;
    await jj('describe', '-m', 'updated description');
    const describeDelta = await waitForSnapshot(
      deltas,
      (d) => d.stateChanged === true,
    );
    expect(describeDelta.stateChanged).toBeTrue();

    deltas.length = 0;
    await jj('undo');
    const undoDelta = await waitForSnapshot(
      deltas,
      (d) => d.stateChanged === true,
    );
    expect(undoDelta.stateChanged).toBeTrue();
  });

  it('emits stateChanged: false on regular file edits in a real jj repository prior to jj snapshot', async () => {
    watcherInstance = new LocalFileSystemWatcher(repo.workspaceRoot);
    await watcherInstance._testOnlyParcelSubscription;

    const deltas: Array<SnapshotDelta | undefined> = [];
    watcherInstance.subscribe((d) => deltas.push(d));

    writeFile('working_tree_file.txt', 'uncommitted edit');
    const delta = await waitForSnapshot(deltas, (d) =>
      d.fileChanges.some(
        (c) =>
          c.path === 'working_tree_file.txt' && c.type === FileChangeType.ADDED,
      ),
    );
    expect(delta.stateChanged).toBeFalse();
  });

  it('sets stateChanged to true when watching a secondary workspace created via SubprocessClient.workspaceAdd', async () => {
    const secondaryTmpParent = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'jj-dojo-secondary-ws-')),
    );
    const secondaryWorkspacePath = path.join(secondaryTmpParent, 'secondary');
    try {
      const client = new SubprocessClient(repo.workspaceRoot);
      const addedWorkspace = await client.workspaceAdd(secondaryWorkspacePath);
      expect(addedWorkspace.workspaceRoot).toBeDefined();

      watcherInstance = new LocalFileSystemWatcher(
        addedWorkspace.workspaceRoot!,
      );
      await watcherInstance._testOnlyParcelSubscription;

      const deltas: Array<SnapshotDelta | undefined> = [];
      watcherInstance.subscribe((d) => deltas.push(d));

      await jj(
        'new',
        '-R',
        addedWorkspace.workspaceRoot!,
        '-m',
        'secondary workspace commit',
      );
      const delta = await waitForSnapshot(
        deltas,
        (d) => d.stateChanged === true,
      );
      expect(delta.stateChanged).toBeTrue();
    } finally {
      if (watcherInstance) {
        await watcherInstance.dispose();
        watcherInstance = null;
      }
      fs.rmSync(secondaryTmpParent, {recursive: true, force: true});
    }
  });
});
