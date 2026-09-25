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
import * as vscode from 'vscode';
import * as watcher from '@parcel/watcher';
import {
  FileSystemWatcher,
  SnapshotDelta,
  FileChangeType,
  FileChange,
} from './file_system_watcher';
import {logAndShowInternalError, logError} from '../logging/logging';
import {JjError} from '../error/error';

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
  // The current snapshot version. To satisfy the FileSystemWatcher interface,
  // we create a monotonically increasing counter.
  private snapshotVersion = 0;

  // Callbacks provided by all subscribers.
  private readonly callbacks = new Set<
    (snapshotDelta: SnapshotDelta | undefined) => void
  >();

  private isDisposed = false;

  private parcelSubscription?: watcher.AsyncSubscription;

  // Path to the `.jj/working_copy/checkout` file.
  private readonly checkoutPath: string;

  constructor(readonly dirPath: string) {
    this.checkoutPath = path.join(
      this.dirPath,
      '.jj',
      'working_copy',
      'checkout',
    );
  }

  async init() {
    try {
      this.parcelSubscription = await watcher.subscribe(
        this.dirPath,
        (err, events) => {
          if (err) {
            logError(JjError.from(err).addPrefix('FileSystemWatcher error'));
            // Notify subscribers that everything changed.
            this.notifySubscribers(undefined);
            return;
          }
          this.publishSnapshot(events);
        },
      );
      if (this.isDisposed) {
        // The current instance might have already been disposed by the time
        // watcher.subscribe completes. If that happens, we need to unsubscribe
        // to the watcher.
        await this.dispose();
      }
    } catch (err: unknown) {
      logError(
        JjError.from(err).addPrefix('FileSystemWatcher initialization error'),
      );
    }
  }

  subscribe(
    cb: (snapshotDelta: SnapshotDelta | undefined) => void,
  ): vscode.Disposable {
    if (!this.parcelSubscription) {
      throw logAndShowInternalError(
        'Programming error: init() is not called before subscribe',
      );
    }
    this.callbacks.add(cb);
    return {
      dispose: () => {
        this.callbacks.delete(cb);
      },
    };
  }

  async dispose(): Promise<void> {
    this.isDisposed = true;
    this.callbacks.clear();
    try {
      await this.parcelSubscription?.unsubscribe();
    } catch (err: unknown) {
      logError(
        JjError.from(err).addPrefix('FileSystemWatcher failed to unsubscribe'),
      );
    }
  }

  private publishSnapshot(events: watcher.Event[]) {
    const fileChanges: FileChange[] = events.map((event) => ({
      uri: vscode.Uri.file(event.path),
      type: this.convertChangeType(event.type),
    }));

    const stateChanged = events.some(
      (event) => event.path === this.checkoutPath,
    );

    const snapshotDelta: SnapshotDelta = {
      stateChanged,
      snapshotVersion: ++this.snapshotVersion,
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
