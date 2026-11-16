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

"""Bzlmod module extension provisioning multi-version hermetic jj binaries."""

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")
load(
    "//tools/bazel/jj:versions.bzl",
    "DEFAULT_JJ_VERSION",
    "JJ_PLATFORMS",
    "JJ_TARBALL_URL_TEMPLATE",
    "JJ_VERSIONS",
    "jj_version_slug",
)

def _jj_binaries_repo_impl(rctx):
    lines = [
        'package(default_visibility = ["//visibility:public"])',
        "",
    ]

    for platform, meta in JJ_PLATFORMS.items():
        lines.extend([
            "config_setting(",
            '    name = "%s",' % platform,
            "    constraint_values = [",
            '        "%s",' % meta["os"],
            '        "%s",' % meta["cpu"],
            "    ],",
            ")",
            "",
        ])

    for version in rctx.attr.versions:
        slug = jj_version_slug(version)
        lines.extend([
            "alias(",
            '    name = "jj_%s",' % slug,
            "    actual = select({",
        ])
        for platform, meta in JJ_PLATFORMS.items():
            binary = meta.get("binary", "jj")
            repo_name = "jj_%s_%s" % (slug, platform)
            lines.append('        ":%s": "@%s//:%s",' % (platform, repo_name, binary))
        lines.extend([
            "    }),",
            ")",
            "",
        ])

    rctx.file("BUILD.bazel", "\n".join(lines))

_jj_binaries_repo = repository_rule(
    implementation = _jj_binaries_repo_impl,
    attrs = {
        "versions": attr.string_list(mandatory = True),
    },
)

def _jj_extension_impl(module_ctx):
    if not JJ_VERSIONS:
        fail("JJ_VERSIONS in //tools/bazel/jj:versions.bzl must not be empty.")
    if DEFAULT_JJ_VERSION not in JJ_VERSIONS:
        fail("DEFAULT_JJ_VERSION '%s' must be a key in JJ_VERSIONS." % DEFAULT_JJ_VERSION)

    for version, platform_hashes in JJ_VERSIONS.items():
        slug = jj_version_slug(version)
        for platform, meta in JJ_PLATFORMS.items():
            if platform not in platform_hashes:
                fail("JJ_VERSIONS['%s'] is missing integrity hash for platform '%s'." % (version, platform))
            binary = meta.get("binary", "jj")
            url_template = meta.get("url_template", JJ_TARBALL_URL_TEMPLATE)
            http_archive(
                name = "jj_%s_%s" % (slug, platform),
                build_file_content = 'exports_files(["%s"])\n' % binary,
                integrity = platform_hashes[platform],
                urls = [url_template % (version, version, meta["target"])],
            )

    _jj_binaries_repo(
        name = "jj_binaries",
        versions = JJ_VERSIONS.keys(),
    )

    return module_ctx.extension_metadata(
        reproducible = True,
    )

jj = module_extension(
    implementation = _jj_extension_impl,
)
