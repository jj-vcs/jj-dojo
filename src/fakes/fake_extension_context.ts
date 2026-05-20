import type * as vscode from 'vscode';
import {FakeExtension} from './fake_extension';
import {unimplemented} from './unimplemented';

export class FakeExtensionContext implements vscode.ExtensionContext {
  readonly subscriptions: vscode.Disposable[] = [];

  readonly extension: vscode.Extension<void>;

  get extensionUri() {
    return unimplemented(this.constructor.name, 'extensionUri');
  }

  constructor(options?: {extension: vscode.Extension<void>}) {
    this.extension = options?.extension ?? new FakeExtension({packageJSON: {}});
  }

  get workspaceState() {
    return unimplemented(this.constructor.name, 'workspaceState');
  }
  get globalState() {
    return unimplemented(this.constructor.name, 'globalState');
  }
  get secrets() {
    return unimplemented(this.constructor.name, 'secrets');
  }
  get extensionPath() {
    return unimplemented(this.constructor.name, 'extensionPath');
  }
  get environmentVariableCollection() {
    return unimplemented(
      this.constructor.name,
      'environmentVariableCollection',
    );
  }
  get asAbsolutePath() {
    return unimplemented(this.constructor.name, 'asAbsolutePath');
  }
  get storageUri() {
    return unimplemented(this.constructor.name, 'storageUri');
  }
  get storagePath() {
    return unimplemented(this.constructor.name, 'storagePath');
  }
  get globalStorageUri() {
    return unimplemented(this.constructor.name, 'globalStorageUri');
  }
  get globalStoragePath() {
    return unimplemented(this.constructor.name, 'globalStoragePath');
  }
  get logUri() {
    return unimplemented(this.constructor.name, 'logUri');
  }
  get logPath() {
    return unimplemented(this.constructor.name, 'logPath');
  }
  get extensionMode() {
    return unimplemented(this.constructor.name, 'extensionMode');
  }
  get languageModelAccessInformation() {
    return unimplemented(
      this.constructor.name,
      'languageModelAccessInformation',
    );
  }
}
