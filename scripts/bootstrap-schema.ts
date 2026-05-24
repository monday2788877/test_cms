import 'dotenv/config'

// Payload Postgres uses Drizzle push mode in development to sync the database schema.
// This script is for local/UAT docker only, where the database may start empty.
// Strict production should use generated Payload migrations instead.

const { getPayload } = await import('payload')
const configModule = await import('../src/payload.config')

const payload = await getPayload({ config: configModule.default })

// Force a lightweight read after initialization. If push mode fails, this will fail loudly.
try {
  await payload.find({ collection: 'app-configs', limit: 1, depth: 0, overrideAccess: true })
} catch (error: any) {
  const message = String(error?.message || error)
  // On a totally empty DB, the initialization should have pushed tables before this query.
  // If it still says relation missing, rethrow so Docker exits clearly.
  throw new Error(`Payload schema bootstrap failed: ${message}`)
}

console.log('Payload schema bootstrap completed')
process.exit(0)
