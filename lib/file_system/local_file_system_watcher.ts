import * as vscode from 'vscode';
import {
  FileSystemWatcher,
  SnapshotDelta,
  FileChangeType,
  FileChange,
} from './file_system_watcher';
import {logError} from '../logging/logging';

export class LocalFileSystemWatcher
  implements FileSystemWatcher, vscode.Disposable
{
  private watcher = vscode.workspace.createFileSystemWatcher('**/*');
  private snapshotVersion = 0;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly callbacks = new Set<
    (snapshotDelta: SnapshotDelta) => void
  >();

  constructor() {
    // Ideally, this shouldn't watch before there is a subscriber,
    // but we expect there to always be a subscriber, so this is
    // fine for now.
    this.disposables.push(
      this.watcher.onDidChange((...args) =>
        this.publishSnapshot(FileChangeType.MODIFIED, ...args),
      ),
      this.watcher.onDidCreate((...args) =>
        this.publishSnapshot(FileChangeType.ADDED, ...args),
      ),
      this.watcher.onDidDelete((...args) =>
        this.publishSnapshot(FileChangeType.DELETED, ...args),
      ),
    );
  }

  subscribe(cb: (snapshotDelta: SnapshotDelta) => void): vscode.Disposable {
    this.callbacks.add(cb);
    return {
      dispose: () => {
        this.callbacks.delete(cb);
      },
    };
  }

  dispose() {
    this.watcher.dispose();
  }

  private publishSnapshot(type: FileChangeType, uri: vscode.Uri) {
    const fileChange: FileChange = {
      uri,
      type,
    };
    const snapshotDelta: SnapshotDelta = {
      stateChanged: false,
      snapshotVersion: ++this.snapshotVersion,
      fileChanges: [fileChange],
    };
    for (const cb of this.callbacks) {
      try {
        cb(snapshotDelta);
      } catch (err: unknown) {
        // If one of the callers throwed an error,
        // the rest of the callers should still get their
        // callback invoked. So we log the error and then
        // eat it.
        logError(err);
      }
    }
  }
}
