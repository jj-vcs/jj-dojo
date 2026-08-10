# How to Contribute

This project is still under development, and does not yet accept external contributions.


## Source Code Headers

Every file containing source code must include copyright and license
information. This includes any JS/CSS files that you might be serving out to
browsers. (This is to help well-intentioned people avoid accidental copying that
doesn't comply with the license.)

Apache header:

    Copyright 2024 Google LLC

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        https://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

## Managing Project Dependencies

This repository uses **pnpm** (via Aspect Rules JS in Bazel) to manage Node.js dependencies. Do not use `npm` or `yarn`.

### Adding or Updating Dependencies

To ensure consistency across developer environments, you must use the Bazel-managed `pnpm` toolchain via the local alias target `//:pnpm`. Do not use a globally installed `pnpm` package manager.

- **Add a dependency**:
  ```bash
  bazel run //:pnpm -- --dir $(pwd) add <package-name>
  ```
- **Update a dependency**:
  ```bash
  bazel run //:pnpm -- --dir $(pwd) update <package-name>
  ```
- **Regenerate lockfile** (after manually editing `package.json`):
  ```bash
  bazel run //:pnpm -- --dir $(pwd) install
  ```

### CI Enforcement

The GitHub Actions runner executes `pnpm install --frozen-lockfile --lockfile-only` to check that the `pnpm-lock.yaml` is fully in sync with `package.json`. If you modify `package.json` but forget to update `pnpm-lock.yaml` using the commands above, the CI build will fail.

## Building and Packaging the Extension

This repository uses Bazel to build, test, and package the extension.

### Building the Extension
To transpile TypeScript sources and generate extension artifacts:
```bash
bazel build //:extension
# or
npm run build
```

### Packaging into a VSIX
To package the extension into a `.vsix` archive:
```bash
bazel build //:vsix
# or
npm run package
```

The output file will be generated at:
```
bazel-bin/jj-dojo.vsix
```

To install the packaged extension locally in VS Code:
```bash
code --install-extension bazel-bin/jj-dojo.vsix
```

### Running Tests
To run the test suite:
```bash
bazel test //:test
# or
npm test
```

