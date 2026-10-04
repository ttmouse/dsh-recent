/**
 * Build for dsh-recent: the node-half ESM library (lib/index.js,
 * lib/invariant.js) plus the browser client bundle (lib/client.js) as a
 * __ModuleLoader__ handoff (the DSH browser plugin contract), resolving
 * externals through the injected require and inlining the CSS Modules as a
 * plugin-tagged <style> tag injected at factory execution. Type declarations
 * are emitted by tsc into lib/types/.
 */
import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const PLUGIN_ID = 'dsh-recent'
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/**
 * Project root, used to keep every virtual CSS module id relative. The
 * bundler prints each module's id in an emitted region comment, so an absolute
 * id would bake this machine's path into the shipped bundle — and make a
 * rebuild on another machine differ from the committed `lib/`.
 */
const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url))

/**
 * Externals answered by the DSH loader module table. ui-primitives is a table
 * word, so the section renders the shell's own icons and state dots instead of
 * shipping a second copy (React context identity must stay single).
 */
const EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives',
]

/** Node half: ESM library entries, dependencies stay external. */
const nodeLibrary: UserConfig = {
  name: PLUGIN_ID,
  entry: { index: 'src/index.ts', invariant: 'src/invariant.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  fixedExtension: false,
  dts: false,
  clean: false,
}

const clientBundle: UserConfig = {
  name: `${PLUGIN_ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  clean: false,
  external: EXTERNALS,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  // Everything not in the loader table must be bundled.
  noExternal: (id: string) => (EXTERNALS.includes(id) ? undefined : true),
  plugins: [{
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined
        ? resolvePath(dirname(importer), source)
        : resolvePath(source)
      return CSS_VIRTUAL_PREFIX + relative(PROJECT_ROOT, abs) + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = resolvePath(PROJECT_ROOT, virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length))
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: relative(PROJECT_ROOT, fileId),
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      // Sorted so the emitted class map is byte-stable across builds: the
      // committed lib/ is compared against a fresh build in CI, and
      // lightningcss's export order is not stable between runs.
      const classMap: Record<string, string> = {}
      for (const local of Object.keys(cssExports ?? {}).sort()) {
        classMap[local] = (cssExports ?? {})[local].name
      }
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(`${PLUGIN_ID}/RecentSessions.module.css`)};`,
        'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
        '  const tag = document.createElement(\'style\');',
        `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [nodeLibrary, clientBundle] satisfies UserConfig[]
