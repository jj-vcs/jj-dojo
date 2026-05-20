import type * as vscode from 'vscode';
import {unimplemented} from './unimplemented';

export class FakeExtension implements vscode.Extension<void> {
  id = 'fake-extension-id';
  readonly packageJSON: unknown = {};

  constructor({id, packageJSON}: {id?: string; packageJSON?: unknown} = {}) {
    this.id = id ?? this.id;
    this.packageJSON = packageJSON ?? this.packageJSON;
  }

  get extensionUri() {
    return unimplemented(this.constructor.name, 'extensionUri');
  }

  get extensionPath() {
    return unimplemented(this.constructor.name, 'extensionPath');
  }

  get isActive() {
    return unimplemented(this.constructor.name, 'isActive');
  }

  get extensionKind() {
    return unimplemented(this.constructor.name, 'extensionKind');
  }

  get exports() {
    return unimplemented(this.constructor.name, 'exports');
  }

  activate() {
    return unimplemented(this.constructor.name, 'activate');
  }
}
