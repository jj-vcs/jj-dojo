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

import 'jasmine';
import * as vscode from 'vscode';
import {Api, CommitId, FileId, OperationId, RepoState} from '../../api/api';
import {SubprocessClient} from '../../client/subprocess_client';
import {fakeCommit} from '../../testing/fakes';
import {fakeVscode, installVscode} from '../../testing/install_vscode';
import {newRepo} from '../../testing/new_repo';
import {WorkingCopyParentFileSystemProvider} from './working_copy_parent_file_system_provider';

const decode = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);

class TestApi implements Api {
  private readonly emitter = new vscode.EventEmitter<void>();
  private pendingListenerResults: unknown[] = [];
  private inFlightRepoState: Promise<unknown> = Promise.resolve();
  private getRepoStateImpl: () => Promise<RepoState>;

  readonly onStateChanged: vscode.Event<void> = (
    listener,
    thisArgs,
    disposables,
  ) => {
    const pendingListenerResults = this.pendingListenerResults;
    return this.emitter.event(
      function (this: unknown, e: void) {
        pendingListenerResults.push(listener.call(this, e));
      },
      thisArgs,
      disposables,
    );
  };

  constructor(private readonly client: SubprocessClient) {
    this.getRepoStateImpl = () => this.client.getWorkspaceState();
  }

  setGetRepoState(fn: () => Promise<RepoState>) {
    this.getRepoStateImpl = fn;
  }

  getRepoState(): Promise<RepoState> {
    const promise = this.getRepoStateImpl();
    this.inFlightRepoState = promise.then(
      () => {},
      () => {},
    );
    return promise;
  }

  readFileAtCommit(
    commitId: CommitId,
    opId: OperationId | undefined,
    workspacePath: string,
    options: {showParent: boolean},
  ): Promise<Uint8Array | undefined> {
    return this.client.readFileAtCommit(commitId, opId, workspacePath, options);
  }

  readFileById(fileId: FileId, workspacePath: string): Promise<Uint8Array> {
    return this.client.readFileById(fileId, workspacePath);
  }

  async waitForPendingState(): Promise<void> {
    await this.inFlightRepoState;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async fireStateChanged(): Promise<void> {
    this.pendingListenerResults.length = 0;
    this.emitter.fire();
    const results = [...this.pendingListenerResults];
    this.pendingListenerResults.length = 0;
    await Promise.all(results);
  }

  dispose() {
    this.emitter.dispose();
  }
}

describe('WorkingCopyParentFileSystemProvider', () => {
  const {jj, repo, writeFile, getWcChangeId, activate} = newRepo();
  let client: SubprocessClient;
  let api: TestApi;
  let providers: WorkingCopyParentFileSystemProvider[];

  beforeEach(() => {
    installVscode();
    fakeVscode().workspace.workspaceFolders = [
      {
        uri: vscode.Uri.file(repo.workspaceRoot),
        name: 'workspace',
        index: 0,
      },
    ];
    client = new SubprocessClient(repo.workspaceRoot);
    api = new TestApi(client);
    providers = [];
  });

  afterEach(() => {
    for (const provider of providers) {
      provider.dispose();
    }
    api.dispose();
  });

  function makeUri(relativePath: string): vscode.Uri {
    return vscode.Uri.from({
      scheme: 'jj-working-copy-parent',
      path: `${repo.workspaceRoot}/${relativePath}`,
    });
  }

  function createProviderWithoutWaiting(): WorkingCopyParentFileSystemProvider {
    const provider = new WorkingCopyParentFileSystemProvider(api);
    providers.push(provider);
    return provider;
  }

  async function createProvider(): Promise<WorkingCopyParentFileSystemProvider> {
    const provider = createProviderWithoutWaiting();
    await api.waitForPendingState();
    return provider;
  }

  it('registers jj-working-copy-parent:// on extension activation', async () => {
    writeFile('dir/file.txt', 'parent-contents');
    await jj('new');
    writeFile('dir/file.txt', 'wc-contents');

    await activate();
    const uri = makeUri('dir/file.txt');

    // Initial state loads asynchronously during WorkingCopyParentFileSystemProvider construction.
    let contents = decode(await vscode.workspace.fs.readFile(uri));
    while (contents === '') {
      await new Promise((resolve) => setTimeout(resolve, 10));
      contents = decode(await vscode.workspace.fs.readFile(uri));
    }

    expect(contents).toEqual('parent-contents');
    const stat = await vscode.workspace.fs.stat(uri);
    expect(stat.type).toEqual(vscode.FileType.File);
  });

  it('reads file contents from the working copy parent, ignoring uncommitted working copy edits', async () => {
    writeFile('dir/file.txt', 'parent-v1');
    await jj('new');
    writeFile('dir/file.txt', 'wc-v2');

    const provider = await createProvider();
    const uri = makeUri('dir/file.txt');

    expect(provider.stat(uri)).toEqual({
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0,
    });
    expect(decode(await provider.readFile(uri))).toEqual('parent-v1');
  });

  it('returns empty bytes when file does not exist in the working copy parent', async () => {
    writeFile('dir/new_file.txt', 'only-in-wc');

    const provider = await createProvider();
    const uri = makeUri('dir/new_file.txt');

    expect(await provider.readFile(uri)).toEqual(new Uint8Array(0));
  });

  it('refreshes emitted files, increments mtime, and fires onDidChangeFile when working copy changes', async () => {
    writeFile('dir/a.txt', 'a-v1');
    writeFile('dir/b.txt', 'b-v1');
    await jj('new');
    writeFile('dir/a.txt', 'a-v2');

    const provider = await createProvider();
    const uriA = makeUri('dir/a.txt');
    const uriB = makeUri('dir/b.txt');
    const uriUntouched = makeUri('dir/c.txt');

    const changeListener = jasmine.createSpy('onDidChangeFile');
    provider.onDidChangeFile(changeListener);

    expect(decode(await provider.readFile(uriA))).toEqual('a-v1');
    expect(provider.stat(uriB).mtime).toEqual(0);

    // Move to a new working copy commit so the commit containing 'a-v2' becomes the parent.
    await jj('new');
    await api.fireStateChanged();

    expect(changeListener).toHaveBeenCalledOnceWith([
      {uri: uriA, type: vscode.FileChangeType.Changed},
      {uri: uriB, type: vscode.FileChangeType.Changed},
    ]);
    expect(provider.stat(uriA).mtime).toEqual(1);
    expect(provider.stat(uriB).mtime).toEqual(1);
    // Distinct Uri instance with the same path shares the same tracked mtime.
    expect(provider.stat(makeUri('dir/a.txt')).mtime).toEqual(1);
    // Newly queried file was not previously emitted, so its initial mtime is 0.
    expect(provider.stat(uriUntouched).mtime).toEqual(0);
    expect(decode(await provider.readFile(uriA))).toEqual('a-v2');
  });

  it('updates parent contents when editing an earlier commit with jj edit', async () => {
    writeFile('dir/file.txt', 'c1-contents');
    await jj('new');
    const c2ChangeId = await getWcChangeId();
    writeFile('dir/file.txt', 'c2-contents');
    await jj('new');
    writeFile('dir/file.txt', 'c3-contents');

    const provider = await createProvider();
    const uri = makeUri('dir/file.txt');
    expect(decode(await provider.readFile(uri))).toEqual('c2-contents');

    await jj('edit', c2ChangeId);
    await api.fireStateChanged();

    expect(provider.stat(uri).mtime).toEqual(1);
    expect(decode(await provider.readFile(uri))).toEqual('c1-contents');
  });

  it('reads parent using unpublished opHead when working copy has unsnapshotted disk changes', async () => {
    writeFile('dir/file.txt', 'parent-contents');
    await jj('new');

    const provider = await createProvider();
    const uri = makeUri('dir/file.txt');
    expect(decode(await provider.readFile(uri))).toEqual('parent-contents');
    expect(provider.stat(uri).mtime).toEqual(0);

    // Modify disk without running a jj command so the new working copy commit only exists
    // in the unpublished snapshot created by getWorkspaceState().
    writeFile('dir/uncommitted.txt', 'dirty-wc');
    await api.fireStateChanged();

    expect(provider.stat(uri).mtime).toEqual(1);
    expect(decode(await provider.readFile(uri))).toEqual('parent-contents');
  });

  it('does not increment mtime or fire onDidChangeFile when working copy commit id is unchanged', async () => {
    writeFile('dir/file.txt', 'parent-contents');
    await jj('new');

    const provider = await createProvider();
    const uri = makeUri('dir/file.txt');
    expect(decode(await provider.readFile(uri))).toEqual('parent-contents');

    const changeListener = jasmine.createSpy('onDidChangeFile');
    provider.onDidChangeFile(changeListener);

    // Create a sibling commit without moving the working copy.
    await jj('new', 'root()', '--no-edit', '-m', 'side-commit');
    await api.fireStateChanged();

    expect(changeListener).not.toHaveBeenCalled();
    expect(provider.stat(uri).mtime).toEqual(0);
  });

  it('does not fire onDidChangeFile when working copy changes if no files were emitted', async () => {
    const provider = await createProvider();
    const changeListener = jasmine.createSpy('onDidChangeFile');
    provider.onDidChangeFile(changeListener);

    await jj('new', '-m', 'next-wc');
    await api.fireStateChanged();

    expect(changeListener).not.toHaveBeenCalled();
  });

  it('returns empty bytes while state is uninitialized, then invalidates once initialized', async () => {
    writeFile('dir/file.txt', 'parent-contents');
    await jj('new');
    writeFile('dir/file.txt', 'wc-contents');

    let resolveInitialState!: (state: RepoState) => void;
    api.setGetRepoState(
      () =>
        new Promise<RepoState>((resolve) => {
          resolveInitialState = resolve;
        }),
    );

    const provider = createProviderWithoutWaiting();
    const changeListener = jasmine.createSpy('onDidChangeFile');
    provider.onDidChangeFile(changeListener);

    const uri = makeUri('dir/file.txt');
    // Before initial getRepoState resolves, readFile returns empty bytes and tracks the uri.
    expect(await provider.readFile(uri)).toEqual(new Uint8Array(0));
    expect(provider.stat(uri).mtime).toEqual(0);
    expect(changeListener).not.toHaveBeenCalled();

    const realState = await client.getWorkspaceState();
    api.setGetRepoState(() => client.getWorkspaceState());
    resolveInitialState(realState);
    await api.waitForPendingState();

    expect(changeListener).toHaveBeenCalledOnceWith([
      {uri, type: vscode.FileChangeType.Changed},
    ]);
    expect(provider.stat(uri).mtime).toEqual(1);
    expect(decode(await provider.readFile(uri))).toEqual('parent-contents');
  });

  it('treats empty commits list as uninitialized until a populated state arrives', async () => {
    writeFile('dir/file.txt', 'parent-contents');
    await jj('new');

    api.setGetRepoState(async () => ({
      opHead: new OperationId(''),
      commits: [],
      conflictedFiles: [],
    }));

    const provider = await createProvider();
    const changeListener = jasmine.createSpy('onDidChangeFile');
    provider.onDidChangeFile(changeListener);

    const uri = makeUri('dir/file.txt');
    expect(await provider.readFile(uri)).toEqual(new Uint8Array(0));
    expect(changeListener).not.toHaveBeenCalled();

    api.setGetRepoState(() => client.getWorkspaceState());
    await api.fireStateChanged();

    expect(changeListener).toHaveBeenCalledOnceWith([
      {uri, type: vscode.FileChangeType.Changed},
    ]);
    expect(provider.stat(uri).mtime).toEqual(1);
    expect(decode(await provider.readFile(uri))).toEqual('parent-contents');
  });

  it('throws an internal error when non-empty repo state has no active working copy commit', async () => {
    await createProvider();

    api.setGetRepoState(async () => ({
      opHead: new OperationId('op-1'),
      commits: [fakeCommit({id: new CommitId('commit-1'), active: false})],
      conflictedFiles: [],
    }));

    await expectAsync(api.fireStateChanged()).toBeRejectedWithError(
      /no working copy commit found in repo state/,
    );
  });

  it('unsubscribes on dispose and ignores in-flight getRepoState completions or errors', async () => {
    let rejectInFlight!: (err: Error) => void;
    api.setGetRepoState(
      () =>
        new Promise<RepoState>((_resolve, reject) => {
          rejectInFlight = reject;
        }),
    );

    const provider = createProviderWithoutWaiting();
    const changeListener = jasmine.createSpy('onDidChangeFile');
    provider.onDidChangeFile(changeListener);
    provider.stat(makeUri('dir/file.txt'));

    provider.dispose();
    rejectInFlight(new Error('repo deleted after dispose'));
    await api.waitForPendingState();

    const getRepoStateSpy = jasmine.createSpy('getRepoState');
    api.setGetRepoState(getRepoStateSpy);
    await api.fireStateChanged();

    expect(getRepoStateSpy).not.toHaveBeenCalled();
    expect(changeListener).not.toHaveBeenCalled();
  });
});
