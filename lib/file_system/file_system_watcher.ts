import * as vscode from 'vscode';

export interface FileSystemWatcher {
  /**
   *
   * @param cb The callback to be invoked when there are new changes to the
   * file system. If `snapshotDelta` is not set, it means any files could have
   * changed. This can happen in network file systems when there are network
   * interruptions and intermediate updates are potentially lost.
   */
  subscribe(cb: (snapshotDelta?: SnapshotDelta) => void): vscode.Disposable;
}

export enum FileChangeType {
  ADDED,
  MODIFIED,
  DELETED,
}

export interface SnapshotDelta {
  // If true, .jj/working_copy/checkout have changed.
  stateChanged: boolean;
  // The current snapshot version. It must be monotonically increasing.
  snapshotVersion: number;
  fileChanges: FileChange[];
}

export interface FileChange {
  uri: vscode.Uri;
  type: FileChangeType;
}
