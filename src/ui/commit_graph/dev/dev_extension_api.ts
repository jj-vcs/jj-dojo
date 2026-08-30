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

import type {ExtensionShape, Order} from '../api/extension_shape';

export class DevExtensionApiImpl implements ExtensionShape {
  async $webviewReady(): Promise<void> {
    console.log('[Fake Extension API] $webviewReady called');
  }

  async $executeCommand(
    repoName: string | undefined,
    command: string,
    args?: unknown[],
  ): Promise<void> {
    console.log('[Fake Extension API] $executeCommand:', {
      repoName,
      command,
      args,
    });
  }

  async $informNewOrder(
    repoName: string | undefined,
    order: Order,
  ): Promise<void> {
    console.log('[Mock Extension API] $informNewOrder:', {repoName, order});
  }

  async $informContextMenuWillOpen(
    repoName: string | undefined,
    hash: string | undefined,
  ): Promise<void> {
    console.log('[Mock Extension API] $informContextMenuWillOpen:', {
      repoName,
      hash,
    });
  }

  async $onClick(
    repoName: string | undefined,
    hash: string,
    metaKey: boolean,
    shiftKey: boolean,
  ): Promise<void> {
    console.log('[Mock Extension API] $onClick:', {
      repoName,
      hash,
      metaKey,
      shiftKey,
    });
  }

  async $clearMultiSelection(repoName: string | undefined): Promise<void> {
    console.log('[Mock Extension API] $clearMultiSelection:', {repoName});
  }

  async $dismissCallout(dismissId: string): Promise<void> {
    console.log('[Mock Extension API] $dismissCallout:', {dismissId});
  }
}
