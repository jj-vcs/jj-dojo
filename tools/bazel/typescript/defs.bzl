# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Common Bazel build macros for TypeScript targets."""

load("@aspect_rules_ts//ts:defs.bzl", "ts_project")

def ts_library(
        name,
        srcs,
        **kwargs):
    """Macro wrapping ts_project for TypeScript libraries, automatically excluding test files.

    Args:
        name: Target name.
        srcs: Source files list or glob. Files starting/ending/containing the 'test' keyword
            are automatically excluded.
        **kwargs: Additional arguments passed through to ts_project.
    """
    srcs = [
        s
        for s in srcs
        if not s.startswith("test_") and not s.endswith("_test.ts") and "_test_" not in s
    ]
    ts_project(
        name = name,
        srcs = srcs,
        composite = True,
        source_map = True,
        transpiler = "tsc",
        tsconfig = "//:tsconfig",
        **kwargs
    )
