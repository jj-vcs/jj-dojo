# How to Contribute

This project is still under development, and does not yet accept external contributions.

## Building/Running the Extension

Inside the VS Code editor, press F5 or run the command `Debug: Start Debugging` from the Command Palette. This will compile and run the extension in a VS Code debug instance. If you just want to compile the code without launching a debug instance, run `npm run build`.

## Testing

We test the following things:

- `npm run test` executes all tests
- `npm run lint` reports any syntax/style issues. `npm run fix` can automatically fix a subset of the reported issues.
- `npm run addlicense` automatically adds license headers to new files.

GitHub Actions has been configured to block PRs if any of the above fails.

## Managing Project Dependencies

This repository uses **pnpm** (via Aspect Rules JS in Bazel) to manage Node.js dependencies. To ensure consistency across developer environments, you must use the Bazel-managed `pnpm` toolchain via the local alias target `//:pnpm`. Do not use a globally installed `pnpm` package manager.

- **Add a dependency**: `npm run dep:add -- <package-name>`
- **Update a dependency**: `npm run dep:update -- <package-name>`
- **Regenerate lockfile** (after manual `package.json` edits): `npm run dep:install`

The GitHub Actions runner executes `pnpm install --frozen-lockfile --lockfile-only` to check that the `pnpm-lock.yaml` is fully in sync with `package.json`. If you modify `package.json` but forget to update `pnpm-lock.yaml` using the commands above, the CI build will fail.


## Packaging into a VSIX

Run `npm run package` to output a `./bazel-bin/jj-dojo.vsix` file. To install the packaged extension locally, run `code --install-extension bazel-bin/jj-dojo.vsix`
