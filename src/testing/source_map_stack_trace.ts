/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

/**
 * Without this file, error messages in tests looks like this:
 * Stack:
 *       at <Jasmine>
 *       at UserContext.<anonymous> (/Users/<user>/Library/Caches/bazel/_bazel_<user>/4b041542771dc8c80d2ce6ac68519496/sandbox/darwin-sandbox/603/execroot/_main/bazel-out/darwin_arm64-fastbuild/bin/src/client/tests_/tests.runfiles/_main/src/client/subprocess_client_test.ts:64:46)
 *       at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
 *
 * Since Bazel runs the code inside the sandbox execroot (i.e. the .../sandbox/<type>/<id>/execroot/_main path above),
 * the error messages points to the sandboxed paths, making it a bit harder to associate
 * the location of the error. Also, bazel deletes the sandbox directory immediately after
 * the test finishes, so clicking on these paths in VS Code or a terminal fails with
 * "File not found". This file fixes it by rewriting stack traces and replacing the bazel
 * sandboxed paths with the original paths.
 *
 * After this fix, the error messages in tests looks like this:
 * Stack:
 *      at <Jasmine>
 *      at UserContext.<anonymous> (/Users/<user>/jj-dojo/src/client/subprocess_client_test.ts:64:46)
 *      at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
 */

// Step 1: Discover the real workspace root on the host machine.
//
// In aspect_rules_js, `process.env.JS_BINARY__EXECROOT` is provided. Inside a
// test sandbox, it points to `.../sandbox/<sandbox_type>/<id>/execroot/_main`.
// Stripping the `/sandbox/<sandbox_type>/<id>` portion gives the persistent
// execroot directory in the Bazel output base (`.../execroot/_main`).
const realExecroot = process.env.JS_BINARY__EXECROOT?.replace(
  /[/\\]sandbox[/\\][^/\\]+[/\\]\d+/,
  '',
);

// In the persistent execroot, Bazel creates symlinks pointing back to the
// original workspace files on the host machine (e.g. `BUILD.bazel` links to
// `/Users/.../github/jj-dojo/BUILD.bazel`).
// Following this symlink with `fs.readlinkSync` gives us the exact host path.
const buildBazel = realExecroot ? path.join(realExecroot, 'BUILD.bazel') : '';
const workspaceRoot =
  buildBazel && fs.existsSync(buildBazel)
    ? path.dirname(path.resolve(realExecroot!, fs.readlinkSync(buildBazel)))
    : '';

// Step 2: Define a pattern to identify Bazel runfiles paths in stack traces.
//
// Stack traces format frames like:
//   "    at UserContext.<anonymous> (/Users/.../tests.runfiles/_main/src/...)"
//
// Under Bzlmod, the root workspace is symlinked as `_main` in the runfiles tree.
// This regex captures the preceding delimiter (`(` or whitespace) and matches
// everything up to and including `...runfiles/_main/`.
const RUNFILES_PATTERN =
  /([(\s])[^()\s]*?[/\\][^/\\]+\.runfiles[/\\]_main[/\\]/g;

// Step 3: Intercept V8's `Error.prepareStackTrace` to rewrite file paths.
//
// When Node.js runs with `--enable-source-maps`, Node installs its own
// `Error.prepareStackTrace` handler that maps transpiled `.js` line and column
// numbers back to `.ts` files.
//
// We invoke Node's original handler first so source mapping is applied, and
// then replace the ephemeral runfiles prefix with the host workspace root.
const originalPrepareStackTrace = Error.prepareStackTrace;
if (originalPrepareStackTrace && workspaceRoot) {
  Error.prepareStackTrace = function (error, callSites) {
    // 1. Let Node's built-in source map handler resolve the TypeScript lines/columns.
    const formatted = originalPrepareStackTrace.call(this, error, callSites);

    // 2. Replace the sandbox runfiles path with the actual workspace root path.
    return typeof formatted === 'string'
      ? formatted.replace(RUNFILES_PATTERN, `$1${workspaceRoot}/`)
      : formatted;
  };
}
