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

export class FakeWorkspaceConfiguration
  implements vscode.WorkspaceConfiguration
{
  private readonly values = new Map<string, unknown>();

  constructor(initial?: Record<string, unknown>) {
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        this.values.set(key, value);
      }
    }
  }

  get<T>(section: string, defaultValue?: T): T | undefined {
    if (this.values.has(section)) {
      return this.values.get(section) as T;
    }
    return defaultValue;
  }

  has(section: string): boolean {
    return this.values.has(section);
  }

  inspect(_section: string): undefined {
    return undefined;
  }

  async update(section: string, value: unknown): Promise<void> {
    this.values.set(section, value);
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  readonly [key: string]: any;
}

export class FakeFileSystem {
  private readonly files = new Map<string, Uint8Array>();

  writeFile(uri: vscode.Uri, content: Uint8Array | string): void {
    const bytes =
      typeof content === 'string' ? new TextEncoder().encode(content) : content;
    this.files.set(uri.toString(), bytes);
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const file = this.files.get(uri.toString());
    if (!file) {
      throw new Error(`File not found: ${uri.toString()}`);
    }
    return file;
  }
}

export class FakeWorkspace {
  readonly onDidChangeTextDocumentEmitter =
    new vscode.EventEmitter<vscode.TextDocumentChangeEvent>();
  readonly onDidChangeTextDocument = this.onDidChangeTextDocumentEmitter.event;

  readonly fs = new FakeFileSystem();
  private readonly configurations = new Map<
    string,
    FakeWorkspaceConfiguration
  >();

  getConfiguration(section?: string): FakeWorkspaceConfiguration {
    const key = section ?? '';
    let config = this.configurations.get(key);
    if (!config) {
      config = new FakeWorkspaceConfiguration();
      this.configurations.set(key, config);
    }
    return config;
  }
}
