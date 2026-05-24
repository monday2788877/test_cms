import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Temporary compatibility patch for Payload 3.84.1 + Next 16.x.
 *
 * Some Payload CLI/runtime paths import @next/env as a default export in
 * node_modules/payload/dist/bin/loadEnv.js. With Next 16 / @next/env 16 this
 * can break under tsx/esbuild CJS interop because @next/env exposes named
 * exports and no default export. This script rewrites that generated file to
 * use a namespace import.
 *
 * Safe to run repeatedly; it is idempotent.
 */
const target = join(process.cwd(), 'node_modules', 'payload', 'dist', 'bin', 'loadEnv.js')

if (!existsSync(target)) {
  console.warn('[patch-payload-load-env] skip: file not found:', target)
  process.exit(0)
}

let source = readFileSync(target, 'utf8')
const beforeImport = "import nextEnvImport from '@next/env';"
const beforeDestructure = 'const { loadEnvConfig } = nextEnvImport;'
const afterImport = "import * as nextEnv from '@next/env';"
const afterDestructure = 'const { loadEnvConfig } = nextEnv;'

if (source.includes(afterImport) && source.includes(afterDestructure)) {
  console.log('[patch-payload-load-env] already patched')
  process.exit(0)
}

if (!source.includes(beforeImport) || !source.includes(beforeDestructure)) {
  console.warn('[patch-payload-load-env] expected pattern not found; leaving file unchanged')
  process.exit(0)
}

source = source.replace(beforeImport, afterImport).replace(beforeDestructure, afterDestructure)
writeFileSync(target, source)
console.log('[patch-payload-load-env] patched Payload loadEnv.js for Next 16 compatibility')
