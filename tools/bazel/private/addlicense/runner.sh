#!/usr/bin/env bash
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

set -euo pipefail

# --- begin runfiles.bash initialization v3 ---
set +e
f="bazel_tools/tools/bash/runfiles/runfiles.bash"
# shellcheck disable=SC1090,SC2312
source "${RUNFILES_DIR:-/dev/null}/${f}" 2>/dev/null || \
  source "$(grep -sm1 "^${f} " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
  source "${0}.runfiles/${f}" 2>/dev/null || \
  source "$(grep -sm1 "^${f} " "${0}.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  source "$(grep -sm1 "^${f} " "${0}.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  { echo >&2 "ERROR: cannot find ${f}"; exit 1; }
set -e
# --- end runfiles.bash initialization v3 ---

if [[ -z "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
  echo >&2 "ERROR: BUILD_WORKSPACE_DIRECTORY is not set. Execute via 'bazel run'."
  exit 1
fi

EXE_RLOCATION="${1}"
MODE="${2}"
shift 2

BIN="$(rlocation "${EXE_RLOCATION}")"
if [[ ! -x "${BIN}" ]]; then
  echo >&2 "ERROR: addlicense binary not found at ${BIN} (rlocation: ${EXE_RLOCATION})"
  exit 1
fi

cd "${BUILD_WORKSPACE_DIRECTORY}"

if [[ "${MODE}" == "check" ]]; then
  exec "${BIN}" -check "$@" .
else
  exec "${BIN}" "$@" .
fi
