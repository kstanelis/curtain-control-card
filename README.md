# Curtain Control Card

A Home Assistant dashboard card that controls 1–8 curtains (`cover` entities) with vertical
sliders, built for wall panels such as the Shelly Wall Display X2.

> Work in progress — not released yet.

## License

MIT

## Security notes

- `overrides` pins `minimatch` ≥ 11.0.1 under `@typescript-eslint/typescript-estree` and `eslint` for
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (dev dependency only).
- The bundle is built with esbuild instead of Rollup because `@rollup/plugin-node-resolve`
  depends on `deepmerge`, which has an unpatched advisory
  ([GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)).
