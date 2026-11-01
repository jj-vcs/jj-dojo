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

import * as vscode from 'vscode';
import {parseConfigKey} from './config_key';

/**
 * An in-memory write-through cache for updating a vscode config.
 *
 * When updating a vscode/cider config, Cider persists it into Spanner before
 * sending a `vscode.workspace.onDidChangeConfiguration` event to all listeners.
 * This causes a few seconds of delay. For some ui commands like toggling the
 * focus mode, users are waiting for the UI to update, and this delay is too
 * long.
 *
 * This WriteBackConfigCache caches the last value provided by the `update`
 * method, and publishes it to all listeners subscribed through the
 * `onDidChangeConfiguration` method. This makes it so that the subscribers
 * are informed of the config change almost immediately.
 *
 * In the event that Cider fails to persist the config change, this class will
 * just stay at the cached value until Cider informs of a new config change
 * that matches the expected update. This is usually not ok if the config were
 * other types like string, where the Cider config implementation could skip
 * intermediate updates if user changed the config to yet another value. But
 * for boolean configs, this is fine.
 */
export class WriteBackConfigCache implements vscode.Disposable {
  private value: boolean | undefined;

  private readonly cbs = new Set<(newValue: boolean) => void>();

  /**
   * For a config like 'jj.graph.focusMode', the section is 'jj' and the key is
   * 'graph.focusMode'.
   */
  private readonly config: {
    section: string;
    key: string;
  };

  private readonly subscription: vscode.Disposable;

  constructor(
    config: string,
    private readonly defaultValue: boolean,
    private readonly contextKey?: string,
  ) {
    const [section, key] = parseConfigKey(config);
    this.config = {section, key};
    this.updateContext();
    this.subscription = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(config)) {
        const newValue = vscode.workspace
          .getConfiguration(section)
          .get<boolean>(key, defaultValue);
        if (this.value !== undefined) {
          if (newValue === this.value) {
            this.value = undefined;
          }
        } else {
          // If this.value is undefined, it means there's no longer any cached
          // value. Since this onDidChangeConfiguration event could come from
          // user updating the Cider config directly through the settings page,
          // we need to inform the subscribers of a possibly new value.
          this.publish();
        }
      }
    });
  }

  update(value: boolean) {
    this.value = value;
    this.publish();
    void vscode.workspace
      .getConfiguration(this.config.section)
      .update(this.config.key, value);
  }

  get(): boolean {
    if (this.value === undefined) {
      return vscode.workspace
        .getConfiguration(this.config.section)
        .get<boolean>(this.config.key, this.defaultValue);
    }
    return this.value;
  }

  private publish() {
    this.updateContext();
    for (const cb of this.cbs) {
      cb(this.get());
    }
  }

  onDidChangeConfiguration(cb: (newValue: boolean) => void): vscode.Disposable {
    this.cbs.add(cb);
    return new vscode.Disposable(() => {
      this.cbs.delete(cb);
    });
  }

  private updateContext() {
    if (this.contextKey === undefined) {
      return;
    }
    void vscode.commands.executeCommand(
      'setContext',
      this.contextKey,
      this.get(),
    );
  }

  dispose() {
    this.subscription.dispose();
    this.cbs.clear();
  }
}
