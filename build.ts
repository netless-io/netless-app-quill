import fs from 'node:fs'
import path from 'node:path'
import * as rollup from 'rollup'
import * as esbuild from 'esbuild'
import * as SASS from 'sass'
import { version, dependencies } from './package.json'

const sass = (): esbuild.Plugin => ({
  name: 'inline-sass',
  setup({ onLoad, esbuild }) {
    onLoad({ filter: /\.scss/ }, async args => {
      if (args.suffix !== '?inline') return
      const { css } = SASS.compile(args.path, { style: 'compressed' })
      const { outputFiles } = await esbuild.build({
        stdin: {
          contents: css,
          loader: 'css',
          resolveDir: path.dirname(args.path),
          sourcefile: args.path,
        },
        loader: {
          ".woff2": "dataurl",
          ".woff": "dataurl",
          ".ttf": "dataurl",
        },
        logLevel: 'silent',
        bundle: true,
        minify: true,
        write: false,
        outdir: 'dist',
        legalComments: 'none',
      })
      const contents = outputFiles[0].text.trimEnd()
      return { contents, loader: 'text' }
    })
  }
})

fs.rmSync('dist', { recursive: true, force: true })

let bundle = await rollup.rollup({
  input: 'src/index.ts',
  external: Object.keys(dependencies),
  plugins: [{
    name: 'esbuild',
    async load(id) {
      const { outputFiles } = await esbuild.build({
        entryPoints: [id],
        bundle: true,
        format: 'esm',
        outfile: id.replace(/\.ts$/, '.js'),
        sourcemap: true,
        write: false,
        target: ['es2017'],
        plugins: [sass()],
        define: {
          __VERSION__: JSON.stringify(version)
        },
        legalComments: 'none',
        external: Object.keys(dependencies)
      })
      let code: any, map: any
      for (const { path, text } of outputFiles) {
        if (path.endsWith('.map')) map = text;
        else code = text;
      }
      return { code, map }
    }
  }]
})

await Promise.all([
  bundle.write({ file: 'dist/index.mjs', format: 'es', sourcemap: true, sourcemapExcludeSources: true }),
  bundle.write({ file: 'dist/index.js', format: 'cjs', sourcemap: true, sourcemapExcludeSources: true, interop: 'auto', exports: 'named' }),
])

await bundle.close()

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  target: ['es2017'],
  plugins: [sass()],
  logLevel: 'info',
  minify: true,
  outfile: 'dist/index.global.js',
  legalComments: 'none',
  globalName: 'NetlessAppQuill'
}).catch(() => process.exit(1))
