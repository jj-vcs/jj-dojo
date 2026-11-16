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

"""Supported Jujutsu (jj) CLI versions and archive metadata for Bazel tests.

To add or update a jj version in the test matrix:
1. Choose a release version from https://github.com/jj-vcs/jj/releases (e.g. v0.45.1).
2. Add or update its entry in `JJ_VERSIONS` below (and update `DEFAULT_JJ_VERSION` if needed).
3. Compute the SRI `integrity` hash (sha256-<base64>) for each platform archive:
     echo "sha256-$(curl -sSL <URL> | openssl dgst -sha256 -binary | openssl base64 -A)"
   Alternatively, set placeholder `integrity` values and run:
     bazel test //src/client:tests
   Bazel will report the expected hash on mismatch for the active host platform.
"""

DEFAULT_JJ_VERSION = "v0.47.1"

JJ_TARBALL_URL_TEMPLATE = "https://github.com/jj-vcs/jj/releases/download/%s/jj-%s-%s.tar.gz"
JJ_ZIP_URL_TEMPLATE = "https://github.com/jj-vcs/jj/releases/download/%s/jj-%s-%s.zip"

JJ_PLATFORMS = {
    "darwin_arm64": {
        "target": "aarch64-apple-darwin",
        "os": "@platforms//os:macos",
        "cpu": "@platforms//cpu:aarch64",
    },
    "darwin_amd64": {
        "target": "x86_64-apple-darwin",
        "os": "@platforms//os:macos",
        "cpu": "@platforms//cpu:x86_64",
    },
    "linux_arm64": {
        "target": "aarch64-unknown-linux-musl",
        "os": "@platforms//os:linux",
        "cpu": "@platforms//cpu:aarch64",
    },
    "linux_amd64": {
        "target": "x86_64-unknown-linux-musl",
        "os": "@platforms//os:linux",
        "cpu": "@platforms//cpu:x86_64",
    },
    "windows_amd64": {
        "target": "x86_64-pc-windows-msvc",
        "os": "@platforms//os:windows",
        "cpu": "@platforms//cpu:x86_64",
        "binary": "jj.exe",
        "url_template": JJ_ZIP_URL_TEMPLATE,
    },
    "windows_arm64": {
        "target": "aarch64-pc-windows-msvc",
        "os": "@platforms//os:windows",
        "cpu": "@platforms//cpu:aarch64",
        "binary": "jj.exe",
        "url_template": JJ_ZIP_URL_TEMPLATE,
    },
}

JJ_VERSIONS = {
    "v0.47.1": {
        "darwin_arm64": "sha256-UBKbUn981q74KuvUuytnC7VnZq3FCe8yecQyeqNZIlU=",
        "darwin_amd64": "sha256-znrHDDt8+Q8ic7T6YtJFdnJ8X9VcYNw4ICIcBTIMdYk=",
        "linux_arm64": "sha256-DzAOFXbejavgqd7fC4euRPiszqXPVNmjQqUQYcH7G80=",
        "linux_amd64": "sha256-1LZX9iLuUJKciRZGbfo9amwXoKMrUOeyx5Nwfsnrytc=",
        "windows_amd64": "sha256-cvn4C8mdB6f0jV8hnPW6uR9+kG5LU/bIJ5SOZGzRFS8=",
        "windows_arm64": "sha256-B/PPbtbblfEr5secdq/5SGiTdanyAfUh30Ro0KDF3oU=",
    },
}

def jj_version_slug(version):
    """Converts a jj version string (e.g. 'v0.45.1') into a Bazel-safe slug ('v0_45_1')."""
    return version.replace(".", "_").replace("-", "_")
