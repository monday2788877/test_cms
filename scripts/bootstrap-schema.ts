import 'dotenv/config'

// Payload Postgres uses Drizzle push mode in development to sync the database schema.
// This script is for local/UAT/Railway deploys where the database may be empty or
// schema may lag behind code. Strict production should run generated Payload migrations.

const { getPayload } = await import('payload')
const configModule = await import('../src/payload.config')
const { DEFAULT_APP_CONFIG } = await import('../src/collections/AppConfigs')

const payload = await getPayload({ config: configModule.default })

async function ensureDefaultAppConfig() {
  const result = await payload.find({
    collection: 'app-configs',
    where: { key: { equals: 'default' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (result.docs?.[0]) return

  await payload.create({
    collection: 'app-configs',
    data: {
      key: 'default',
      limits: {
        maxImagesPerProperty: DEFAULT_APP_CONFIG.maxImagesPerProperty,
        maxVideosPerProperty: DEFAULT_APP_CONFIG.maxVideosPerProperty,
        maxImageUploadMbPerProperty: DEFAULT_APP_CONFIG.maxImageUploadMbPerProperty,
        maxVideoUploadMbPerProperty: DEFAULT_APP_CONFIG.maxVideoUploadMbPerProperty,
        maxPendingPropertiesPerUser: DEFAULT_APP_CONFIG.maxPendingPropertiesPerUser,
        maxPropertiesPerUserPerDay: DEFAULT_APP_CONFIG.maxPropertiesPerUserPerDay,
      },
      permissions: {
        allowUserRegistration: DEFAULT_APP_CONFIG.allowUserRegistration,
        allowGoogleLogin: DEFAULT_APP_CONFIG.allowGoogleLogin,
        allowGoogleAutoCreateUser: DEFAULT_APP_CONFIG.allowGoogleAutoCreateUser,
        allowUserCreateProperty: DEFAULT_APP_CONFIG.allowUserCreateProperty,
        allowUserEditProperty: DEFAULT_APP_CONFIG.allowUserEditProperty,
        autoApproveUserProperties: DEFAULT_APP_CONFIG.autoApproveUserProperties,
      },
      notes: 'Auto-created by bootstrap:schema during deploy.',
    },
    overrideAccess: true,
  })
}

try {
  await ensureDefaultAppConfig()
} catch (error: any) {
  const message = String(error?.message || error)
  throw new Error(`Payload schema bootstrap failed. Database schema is not in sync with Payload collections. ${message}`)
}

console.log('Payload schema bootstrap completed and default app-config is ready')
process.exit(0)
