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

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

export function assertHermeticJjConfigured(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const jjVersion = env.JJ_VERSION;
  if (!jjVersion) {
    throw new Error(
      'JJ_VERSION environment variable is not set. Ensure the jasmine_test target sets use_jj = True.',
    );
  }
  return jjVersion;
}

export function resolveHermeticJjDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const jjVersion = assertHermeticJjConfigured(env);
  const testSrcdir = env.TEST_SRCDIR;
  if (!testSrcdir) {
    throw new Error('TEST_SRCDIR environment variable is not set.');
  }

  const jjDir = path.join(
    testSrcdir,
    '_main',
    'tools',
    'bazel',
    'jj',
    jjVersion,
  );
  const jjBinaryName = platform === 'win32' ? 'jj.exe' : 'jj';
  const jjBinaryPath = path.join(jjDir, jjBinaryName);
  if (!fs.existsSync(jjBinaryPath)) {
    const slug = jjVersion.replace(/[.-]/g, '_');
    throw new Error(
      `Hermetic jj binary not found at ${jjBinaryPath}. Verify //tools/bazel/jj:copy_jj_${slug} is staged in test data.`,
    );
  }
  return jjDir;
}
