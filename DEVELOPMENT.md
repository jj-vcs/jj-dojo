# Managing Project Dependencies

This repository uses **pnpm** (via Aspect Rules JS in Bazel) to manage Node.js dependencies. Do not use `npm` or `yarn`.

## Adding or Updating Dependencies

To ensure consistency across developer environments, you must use the Bazel-managed `pnpm` toolchain via the local alias target `//:pnpm`. Do not use a globally installed `pnpm` package manager.

- **Add a dependency**:
  ```bash
  bazel run //:pnpm -- add <package-name>
  ```
- **Update a dependency**:
  ```bash
  bazel run //:pnpm -- update <package-name>
  ```
- **Regenerate lockfile** (after manually editing `package.json`):
  ```bash
  bazel run //:pnpm -- install
  ```

## CI Enforcement

The GitHub Actions runner executes `pnpm install --frozen-lockfile --lockfile-only` to check that the `pnpm-lock.yaml` is fully in sync with `package.json`. If you modify `package.json` but forget to update `pnpm-lock.yaml` using the commands above, the CI build will fail.
