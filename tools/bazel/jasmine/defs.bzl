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

"""Common Bazel build macros for Jasmine tests."""

load("@aspect_rules_ts//ts:defs.bzl", "ts_project")
load("@npm//:jasmine/package_json.bzl", jasmine_bin = "bin")

def jasmine_test(
        name,
        srcs,
        deps = []):
    """Macro for compiling TypeScript test files and executing Jasmine unit tests.

    Creates a ts_project target to compile test sources with Jasmine types,
    and a jasmine_bin.jasmine_test target to run the test suite.

    Args:
        name: Target name.
        srcs: Test source files list or glob.
        deps: Dependencies for the test target.
    """
    ts_project_name = name + "_ts_project"
    ts_project(
        name = ts_project_name,
        srcs = srcs,
        composite = True,
        source_map = True,
        transpiler = "tsc",
        tsconfig = "//:tsconfig",
        deps = deps + [
            "//:node_modules/@types/jasmine",
        ],
    )

    pkg = native.package_name()
    depth = len(pkg.split("/")) if pkg else 0
    rel_path = "../" * depth

    jasmine_bin.jasmine_test(
        name = name,
        size = "small",
        args = [
            "--config=" + rel_path + "spec/support/jasmine.json",
        ],
        chdir = pkg,
        data = [
            "//:jasmine_config",
            "//:node_modules",
            ts_project_name,
        ],
    )

