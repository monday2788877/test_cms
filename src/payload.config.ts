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

const publicServerURL = process.env.PAYLOAD_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const corsOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  publicServerURL,
  process.env.FRONTEND_URL,
  process.env.PUBLIC_API_URL,
  process.env.KONG_PUBLIC_URL,
].filter(Boolean) as string[]

const plugins = []

if (r2Enabled) {
  plugins.push(
    s3Storage({
      collections: {
        media: true,
      },
      bucket: process.env.R2_BUCKET || '',
      config: {
        endpoint:
          process.env.R2_ENDPOINT ||
          (process.env.R2_ACCOUNT_ID
            ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
            : undefined),
        region: process.env.R2_REGION || 'auto',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  )
}

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
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  plugins,
})
