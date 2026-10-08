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

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as watcher from '@parcel/watcher';
import {
  FileSystemWatcher,
  SnapshotDelta,
  FileChangeType,
  FileChange,
} from './file_system_watcher';
import {
  logAndShowInternalError,
  logAndShowUserError,
  logError,
  logInfo,
} from '../logging/logging';
import {JjError} from '../error/error';

export interface LocalFileSystemWatcherTestInjections {
  overrideSubscribeForTests?: typeof watcher.subscribe;
}

/**
 * A local file system watcher that watches for file system updates using @parcel/watcher.
 * @parcel/watcher is used instead of vscode.workspace.createFileSystemWatcher since
 * the former supports file exclusions. This is critical for us to ignore file updates
 * from .gitignore files. According to https://github.com/microsoft/vscode/issues/169724,
 * there is no plan to support file exclusions for the builtin file watcher.
 */
export class LocalFileSystemWatcher
  implements FileSystemWatcher, vscode.Disposable
{
  /**
   * The current snapshot number. To satisfy the FileSystemWatcher interface,
   * we create a monotonically increasing counter.
   */
  private snapshotNumber = 0;

  /** Callbacks provided by all subscribers. */
  private readonly callbacks = new Set<
    (snapshotDelta: SnapshotDelta | undefined) => void
  >();

  private parcelSubscription: Promise<watcher.AsyncSubscription>;

  get _testOnlyParcelSubscription(): Promise<watcher.AsyncSubscription> {
    return this.parcelSubscription;
  }

  /**
   * Path to the directory that is being watched. Must be an absolute path
   * and without a trailing slash (except for root).
   */
  private readonly dirPath: string;

  /**
   * Path to the `.jj/working_copy/checkout` file. Must be an absolute path
   * and without a trailing slash.
   */
  private readonly checkoutPath: string;

  constructor(
    targetPath: string,
    testInjections?: LocalFileSystemWatcherTestInjections,
  ) {
    if (!path.isAbsolute(targetPath)) {
      throw logAndShowInternalError(
        `LocalFileSystemWatcher received non-absolute path: ${targetPath}`,
      );
    }

    // Since parcel watcher does not follow symlinks, we'll need to get the
    // actual path. Also, realPath strips trailing slashes except for root dirs.
    try {
      this.dirPath = fs.realpathSync.native(targetPath);
    } catch (err: unknown) {
      throw logAndShowUserError(
        JjError.from(err).addPrefix(
          `LocalFileSystemWatcher failed to resolve path: ${targetPath}`,
        ),
      );
    }

    this.checkoutPath = path.join(
      this.dirPath,
      '.jj',
      'working_copy',
      'checkout',
    );
    const subscribeFn =
      testInjections?.overrideSubscribeForTests ?? watcher.subscribe;
    this.parcelSubscription = subscribeFn(this.dirPath, (err, events) => {
      if (err) {
        logError(JjError.from(err).addPrefix('FileSystemWatcher error'));
        // Notify subscribers that everything changed.
        this.notifySubscribers(undefined);
        return;
      }
      this.publishSnapshot(events);
    });

    this.parcelSubscription
      .then(() => {
        logInfo(`LocalFileSystemWatcher watching: ${this.dirPath}`);
        // Once the watcher is ready, notify that everything changed so
        // the caller does not miss updates in between.
        this.notifySubscribers(undefined);
      })
      .catch((err) => {
        throw logAndShowUserError(
          JjError.from(err).addPrefix('FileSystemWatcher failed to subscribe'),
        );
      });
  }

  subscribe(
    cb: (snapshotDelta: SnapshotDelta | undefined) => void,
  ): vscode.Disposable {
    this.callbacks.add(cb);
    return {
      dispose: () => {
        this.callbacks.delete(cb);
      },
    };
  }

  async dispose(): Promise<void> {
    this.callbacks.clear();
    try {
      const subscription = this.parcelSubscription;
      // Clear the parcelSubscription, to avoid repeated dispose()
      // calls from calling unsubscribe repeatedly
      this.parcelSubscription = Promise.resolve({
        unsubscribe: () => Promise.resolve(),
      });
      await (await subscription).unsubscribe();
    } catch (err: unknown) {
      logError(
        JjError.from(err).addPrefix('FileSystemWatcher failed to unsubscribe'),
      );
    }
  }

  private publishSnapshot(events: watcher.Event[]) {
    const fileChanges: FileChange[] = events.map((event) => ({
      path: path.relative(this.dirPath, event.path),
      type: this.convertChangeType(event.type),
    }));

    const stateChanged = events.some(
      (event) => event.path === this.checkoutPath,
    );

    const snapshotDelta: SnapshotDelta = {
      stateChanged,
      snapshotNumber: ++this.snapshotNumber,
      fileChanges,
    };

    this.notifySubscribers(snapshotDelta);
  }

  private notifySubscribers(snapshotDelta: SnapshotDelta | undefined) {
    for (const cb of this.callbacks) {
      try {
        cb(snapshotDelta);
      } catch (err: unknown) {
        // If one of the callers threw an error, the rest of the callers
        // should still get their callback invoked. So we log the error and
        // then eat it.
        logError(err);
      }
    }
  }

  private convertChangeType(type: watcher.EventType): FileChangeType {
    switch (type) {
      case 'create':
        return FileChangeType.ADDED;
      case 'update':
        return FileChangeType.MODIFIED;
      case 'delete':
        return FileChangeType.DELETED;
    }
  }
}
