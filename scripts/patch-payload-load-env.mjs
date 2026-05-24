import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Temporary compatibility patch for Payload 3.84.1 + Next 16.x.
 *
 * Payload CLI loadEnv imports @next/env as a default export in some builds.
 * With Next 16 / @next/env 16, loadEnvConfig is a named export. Patch both
 * compiled JS and source TS copies because some runtimes/tsx stacks resolve
 * into node_modules/payload/src/bin/loadEnv.ts.
 */
const targets = [
  join(process.cwd(), 'node_modules', 'payload', 'dist', 'bin', 'loadEnv.js'),
  join(process.cwd(), 'node_modules', 'payload', 'src', 'bin', 'loadEnv.ts'),
]

const replacements = [
  ["import nextEnvImport from '@next/env';", "import * as nextEnv from '@next/env';"],
  ["import nextEnvImport from '@next/env'", "import * as nextEnv from '@next/env'"],
  ['const { loadEnvConfig } = nextEnvImport;', 'const { loadEnvConfig } = nextEnv;'],
  ['const { loadEnvConfig } = nextEnvImport', 'const { loadEnvConfig } = nextEnv'],
]

for (const target of targets) {
  if (!existsSync(target)) {
    console.warn('[patch-payload-load-env] skip: file not found:', target)
    continue
  }

  let source = readFileSync(target, 'utf8')
  const original = source

  for (const [before, after] of replacements) {
    source = source.split(before).join(after)
  }

  if (source !== original) {
    writeFileSync(target, source)
    console.log('[patch-payload-load-env] patched:', target)
  } else if (source.includes('import * as nextEnv') && source.includes('loadEnvConfig')) {
    console.log('[patch-payload-load-env] already patched:', target)
  } else {
    console.warn('[patch-payload-load-env] expected pattern not found; leaving unchanged:', target)
  }
}
