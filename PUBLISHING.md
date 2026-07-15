# Publishing the SDK & CLI

Both packages are versioned at `0.9.0` and configured for public scoped
publishing (`publishConfig.access = "public"`).

## 1. Build

```bash
cd packages/sdk && npm run build
cd ../cli && npm run build
```

## 2. Publish the SDK first

```bash
cd packages/sdk
npm publish
```

## 3. Point the CLI at the published SDK

During local development the CLI depends on the SDK via `file:../sdk`. Before
publishing the CLI, switch that dependency to the released range:

```jsonc
// packages/cli/package.json
"dependencies": {
  "@smartcloud/sdk": "^0.9.0",
  "commander": "^13.1.0"
}
```

Then:

```bash
cd packages/cli
npm publish
```

> Requires `npm login` with an account that can publish under the `@smartcloud`
> scope. This step is a maintainer action and is intentionally not automated in
> CI.
