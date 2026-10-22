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

/// <reference types="node" />

import childProcess from 'node:child_process';
import util from 'node:util';

const execFile = util.promisify(childProcess.execFile);

// execFile defaults to a 1 MiB maxBuffer, which is too small for
// file contents or large commit descriptions.
//
// Note that we also don't want to set it to too large. As of the time
// of this writing (Oct 2026), this extension still uses the vscode
// FileSystemProvider to show diffs. Its readFile api requires loading
// the full file contents at once, so it's best to have an upper limit.
//
// For jj subprocesses, since JJ skips snapshotting files larger than
// 1 MiB by default, the majority of users never run into the maxBuffer
// limit imposed here.
const MAX_BUFFER_BYTES = 10 * 1024 * 1024; // 10 MiB

let maxBuffer = MAX_BUFFER_BYTES;

function setMaxBufferForTest(numBytes: number) {
  maxBuffer = numBytes;
}

function resetMaxBufferForTest() {
  maxBuffer = MAX_BUFFER_BYTES;
}

export const TEST_ONLY = {
  setMaxBufferForTest,
  resetMaxBufferForTest,
};

export async function subprocess(options: {
  cwd: string;
  command: string;
  args: string[];
}): Promise<{
  stdout: string;
  stderr: string;
}> {
  const {cwd, command, args} = options;

  return execFile(command, args, {
    cwd,
    timeout: 10000,
    maxBuffer,
  });
}

export async function subprocessBuffer(options: {
  cwd: string;
  command: string;
  args: string[];
}): Promise<{
  stdout: Uint8Array;
  stderr: string;
}> {
  const {cwd, command, args} = options;

  const {stdout, stderr} = await execFile(command, args, {
    cwd,
    timeout: 10000,
    maxBuffer,
    encoding: 'buffer',
  });
  return {
    stdout: new Uint8Array(stdout.buffer, stdout.byteOffset, stdout.byteLength),
    stderr: stderr.toString('utf-8'),
  };
}
