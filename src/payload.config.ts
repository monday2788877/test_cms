import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Districts } from './collections/Districts'
import { Properties } from './collections/Properties'
import { AppConfigs } from './collections/AppConfigs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const r2Enabled = process.env.R2_ENABLED === 'true'
// UAT/Railway safety: allow an explicit schema push before Next starts.
// In strict production, set PAYLOAD_DB_PUSH=false and run Payload migrations instead.
const dbPushEnabled = process.env.PAYLOAD_DB_PUSH === 'true' || (process.env.NODE_ENV !== 'production' && process.env.PAYLOAD_DB_PUSH !== 'false')

const publicServerURL = process.env.PAYLOAD_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const configuredOrigins = [
  process.env.CORS_ORIGINS,
  process.env.CSRF_ORIGINS,
]
  .filter(Boolean)
  .flatMap((value) => String(value).split(',').map((origin) => origin.trim()).filter(Boolean))

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  'https://uat-agreement.tpbs.com.vn',
  'https://testcms-production.up.railway.app',
]

const corsOrigins = Array.from(new Set([
  ...defaultAllowedOrigins,
  publicServerURL,
  process.env.FRONTEND_URL,
  process.env.NEXT_PUBLIC_FRONTEND_URL,
  process.env.PUBLIC_API_PUBLIC_URL,
  process.env.PUBLIC_API_URL,
  process.env.KONG_PUBLIC_URL,
  ...configuredOrigins,
].filter(Boolean) as string[]))

const r2Endpoint =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined)

const plugins = [
  // Keep the plugin registered even when disabled so Payload can generate the
  // admin importMap for @payloadcms/storage-s3/client#S3ClientUploadHandler.
  // Railway builds may not have runtime R2 variables available at image-build
  // time, so disabling by omitting the plugin can break the Admin UI.
  s3Storage({
    enabled: r2Enabled,
    collections: {
      media: true,
    },
    bucket: process.env.R2_BUCKET || 'disabled-r2-bucket',
    config: {
      endpoint: r2Endpoint,
      region: process.env.R2_REGION || 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || 'disabled',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'disabled',
      },
    },
  } as any),
]

export default buildConfig({
  serverURL: publicServerURL,
  cors: corsOrigins,
  csrf: corsOrigins,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, 'app/(payload)/admin/importMap.js'),
    },
    meta: {
      titleSuffix: '- Real Estate Admin',
    },
  },
  editor: lexicalEditor({}),
  collections: [Users, Media, Districts, Properties, AppConfigs],
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || process.env.DATABASE_URI,
    },
    push: dbPushEnabled,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  plugins,
})
