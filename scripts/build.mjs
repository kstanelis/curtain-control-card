// Bundle the card into one ES module for Home Assistant / HACS.
import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['src/curtain-control-card.ts'],
  outfile: 'dist/curtain-control-card.js',
  bundle: true,
  format: 'esm',
  target: 'es2021',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context({ ...options, minify: false, sourcemap: 'inline' });
  await ctx.watch();
} else {
  await esbuild.build(options);
}
