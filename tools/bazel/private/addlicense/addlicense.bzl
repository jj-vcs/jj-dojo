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

"""Macro generating addlicense .fix and .check targets."""

load("@rules_shell//shell:sh_binary.bzl", "sh_binary")

DEFAULT_IGNORES = [
    ".git/**",
    ".jj/**",
    "node_modules/**",
    "out/**",
    "bazel-*/**",
    "bazel-*",
    "pnpm-lock.yaml",
    "MODULE.bazel.lock",
    "package-lock.json",
    ".vscode/**",
    "**/*.json",
]

def addlicense(name = "addlicense", copyright_holder = "Google LLC", license_type = "apache", extra_ignores = [], **kwargs):
    ignore_args = []
    for pattern in DEFAULT_IGNORES + extra_ignores:
        ignore_args.extend(["-ignore", pattern])

    common_args = ["-l", license_type, "-c", "\"%s\"" % copyright_holder] + ignore_args

    sh_binary(
        name = name + ".fix",
        srcs = ["//tools/bazel/private/addlicense:runner.sh"],
        data = [
            "//tools/bazel/private/addlicense:addlicense",
            "@bazel_tools//tools/bash/runfiles",
        ],
        args = [
            "$(rlocationpath //tools/bazel/private/addlicense:addlicense)",
            "fix",
        ] + common_args,
        deps = ["@bazel_tools//tools/bash/runfiles"],
        **kwargs
    )

    sh_binary(
        name = name + ".check",
        srcs = ["//tools/bazel/private/addlicense:runner.sh"],
        data = [
            "//tools/bazel/private/addlicense:addlicense",
            "@bazel_tools//tools/bash/runfiles",
        ],
        args = [
            "$(rlocationpath //tools/bazel/private/addlicense:addlicense)",
            "check",
        ] + common_args,
        deps = ["@bazel_tools//tools/bash/runfiles"],
        **kwargs
    )

