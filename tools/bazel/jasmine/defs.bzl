# @license
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
load("//tools/bazel/jj:versions.bzl", "JJ_VERSIONS", "jj_version_slug")

def jasmine_test(
        name,
        srcs,
        deps = [],
        use_jj = False,
        jj_versions = None,
        tags = [],
        size = "small"):
    """Macro for compiling TypeScript test files and executing Jasmine unit tests.

    Creates a single ts_project target to compile test sources with Jasmine types.
    When `use_jj` is False, creates a single `jasmine_test` target. When `use_jj`
    is True, expands one `jasmine_test` target per supported `jj` CLI version
    (configurable in `//tools/bazel/jj:versions.bzl` or overridden via
    `jj_versions`) and groups them under a `test_suite` named `name`.

    Args:
        name: Target name (or `test_suite` name when `use_jj = True`).
        srcs: Test source files list or glob.
        deps: Dependencies for the test target.
        use_jj: Whether the test invokes the real `jj` CLI binary and should be
            matrixed across supported `jj` versions.
        jj_versions: Optional explicit non-empty list of `jj` version strings
            (must be a subset of `JJ_VERSIONS` in `//tools/bazel/jj:versions.bzl`).
            Requires `use_jj = True`.
        tags: Optional Bazel tags applied to generated test targets.
        size: Bazel test size (defaults to `"small"`).
    """
    if jj_versions != None:
        if not use_jj:
            fail("Set use_jj = True when specifying jj_versions on jasmine_test '%s'." % name)
        if len(jj_versions) == 0:
            fail("jj_versions on jasmine_test '%s' must not be empty." % name)
        for version in jj_versions:
            if version not in JJ_VERSIONS:
                fail("Unknown jj version '%s' in jasmine_test '%s'. Supported versions in //tools/bazel/jj:versions.bzl: %s" % (
                    version,
                    name,
                    ", ".join(JJ_VERSIONS.keys()),
                ))

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

    base_data = [
        "//:jasmine_config",
        "//:node_modules",
        "//src/testing",
        ts_project_name,
    ]

    if not use_jj:
        jasmine_bin.jasmine_test(
            name = name,
            size = size,
            args = [
                "--config=" + rel_path + "spec/support/jasmine.json",
                "--helper=" + rel_path + "src/testing/install_global_vscode.js",
                "--helper=" + rel_path + "src/testing/install_global_jj.js",
                "--helper=" + rel_path + "src/testing/source_map_stack_trace.js",
            ],
            node_options = [
                "--enable-source-maps",
            ],
            chdir = pkg,
            tags = tags,
            data = base_data + [
                "//tools/bazel/jj:copy_jj",
            ],
        )
        return

    resolved_versions = jj_versions if jj_versions != None else JJ_VERSIONS.keys()
    subtargets = []
    for version in resolved_versions:
        slug = jj_version_slug(version)
        subtarget = "%s_%s" % (name, slug)
        subtargets.append(":" + subtarget)
        jasmine_bin.jasmine_test(
            name = subtarget,
            size = size,
            args = [
                "--config=" + rel_path + "spec/support/jasmine.json",
                "--helper=" + rel_path + "src/testing/install_global_vscode.js",
                "--helper=" + rel_path + "src/testing/install_global_jj.js",
                "--helper=" + rel_path + "src/testing/source_map_stack_trace.js",
            ],
            node_options = [
                "--enable-source-maps",
            ],
            chdir = pkg,
            env = {
                "JJ_VERSION": version,
            },
            tags = tags + [
                "jj_matrix",
                "jj_" + slug,
            ],
            data = base_data + [
                "//tools/bazel/jj:copy_jj_" + slug,
            ],
        )

    native.test_suite(
        name = name,
        tests = subtargets,
        tags = tags,
    )
