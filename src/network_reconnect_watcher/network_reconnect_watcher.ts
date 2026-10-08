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

import * as vscode from 'vscode';

/**
 * A class that watches for network reconnections and invokes
 * provided callbacks.
 */
export interface NetworkReconnectWatcher {
  /**
   * subscribe to the watcher.
   *
   * @param cb The callback to be invoked when there are network
   * reconnections.
   */
  subscribe(
    /** The callback to be invoked when a signal is received. */
    cb: () => void,
  ): vscode.Disposable;
}
