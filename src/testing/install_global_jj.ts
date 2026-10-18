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

import * as path from 'node:path';
import process from 'node:process';

const jjDir = path.join(
  process.env.TEST_SRCDIR!,
  '_main',
  'tools',
  'bazel',
  'jj',
);

// `jj` transport commands (`jj git clone`, `jj git fetch`, `jj git push`)
// shell out to the `git` CLI using `git fetch --porcelain`, which requires
// Git >= 2.41.0.
//
// Bazel sanitizes `PATH` in test actions to `/bin:/usr/bin:/usr/local/bin`.
// Without prepending `/usr/local/git/current/bin` (gMac) and
// `/opt/homebrew/bin` (Apple Silicon Homebrew) before `/usr/bin`, tests on
// macOS fall back to Apple's Xcode Git at `/usr/bin/git` (< 2.41.0) and fail
// with:
//   Error: Git does not recognize required option: porcelain (note: Jujutsu requires git >= 2.41.0)
const extraPaths = [jjDir, '/usr/local/git/current/bin', '/opt/homebrew/bin'];
process.env.PATH = [extraPaths.join(path.delimiter), process.env.PATH]
  .filter(Boolean)
  .join(path.delimiter);
