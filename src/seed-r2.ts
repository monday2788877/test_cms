import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from './payload.config'
import { DEFAULT_APP_CONFIG } from './collections/AppConfigs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const assetsDir = path.resolve(dirname, '../seed-assets')

const requiredR2Vars = [
  'R2_ENABLED',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_ENDPOINT',
  'R2_PUBLIC_URL',
]

function assertAsset(fileName: string) {
  const filePath = path.join(assetsDir, fileName)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing seed asset: ${filePath}`)
  }
  return filePath
}

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function findByField(payload: any, collection: string, field: string, value: string) {
  const result = await payload.find({
    collection,
    where: { [field]: { equals: value } },
    limit: 1,
    overrideAccess: true,
  })
  return result.docs?.[0]
}

async function upsertUser(payload: any, data: any) {
  const existing = await findByField(payload, 'users', 'email', data.email)
  if (existing) return existing
  return payload.create({ collection: 'users', data, overrideAccess: true })
}

async function upsertDistrict(payload: any) {
  const existing = await findByField(payload, 'districts', 'code', 'r2-demo')
  if (existing) return existing
  return payload.create({
    collection: 'districts',
    overrideAccess: true,
    data: {
      name: 'R2 Demo District',
      city: 'Demo City',
      code: 'r2-demo',
    },
  })
}

async function upsertAppConfig(payload: any) {
  const existing = await findByField(payload, 'app-configs', 'key', 'default')
  const data = {
    key: 'default',
    limits: {
      maxImagesPerProperty: DEFAULT_APP_CONFIG.maxImagesPerProperty,
      maxVideosPerProperty: DEFAULT_APP_CONFIG.maxVideosPerProperty,
      maxImageUploadMbPerProperty: DEFAULT_APP_CONFIG.maxImageUploadMbPerProperty,
      maxVideoUploadMbPerProperty: DEFAULT_APP_CONFIG.maxVideoUploadMbPerProperty,
      maxPendingPropertiesPerUser: DEFAULT_APP_CONFIG.maxPendingPropertiesPerUser,
    },
    permissions: {
      allowUserRegistration: DEFAULT_APP_CONFIG.allowUserRegistration,
      allowGoogleLogin: DEFAULT_APP_CONFIG.allowGoogleLogin,
      allowGoogleAutoCreateUser: DEFAULT_APP_CONFIG.allowGoogleAutoCreateUser,
      allowUserCreateProperty: DEFAULT_APP_CONFIG.allowUserCreateProperty,
      allowUserEditProperty: DEFAULT_APP_CONFIG.allowUserEditProperty,
      autoApproveUserProperties: DEFAULT_APP_CONFIG.autoApproveUserProperties,
    },
    notes: 'Config mặc định được tạo bởi seed:r2 để test upload Cloudflare R2.',
  }
  if (existing) {
    return payload.update({ collection: 'app-configs', id: existing.id, data, overrideAccess: true })
  }
  return payload.create({ collection: 'app-configs', data, overrideAccess: true })
}

async function deleteExistingDemoMedia(payload: any, fileName: string) {
  const existing = await findByField(payload, 'media', 'filename', fileName)
  if (!existing) return
  await payload.delete({ collection: 'media', id: existing.id, overrideAccess: true })
}

async function createR2Media(payload: any, fileName: string, alt: string) {
  // Re-upload by default so this script actually pushes the demo file to the
  // current storage backend. It only touches r2-demo-* files.
  if (process.env.R2_REUPLOAD_EXISTING !== 'false') {
    await deleteExistingDemoMedia(payload, fileName)
  }

  const existing = await findByField(payload, 'media', 'filename', fileName)
  if (existing) return existing

  const doc = await payload.create({
    collection: 'media',
    overrideAccess: true,
    data: { alt },
    filePath: assertAsset(fileName),
  })

  return doc
}

function mediaUrl(doc: any) {
  return doc?.publicUrl || doc?.url || doc?.sizes?.card?.url || doc?.sizes?.thumb?.url || ''
}

async function main() {
  const missing = requiredR2Vars.filter((key) => !process.env[key])
  if (missing.length) {
    console.warn(`Missing R2 env vars: ${missing.join(', ')}`)
    console.warn('The script will still create Payload Media records, but files may use local storage instead of R2.')
  }

  if (process.env.R2_ENABLED !== 'true') {
    console.warn('R2_ENABLED is not true. Set R2_ENABLED=true on Railway before running yarn seed:r2.')
  }

  const payload = await getPayload({ config })
  await upsertAppConfig(payload)

  const adminUser = await upsertUser(payload, {
    email: 'admin@gmail.com',
    password: '123456',
    fullName: 'Admin Real Estate',
    role: 'admin',
    authProvider: 'local',
  })

  const demoUser = await upsertUser(payload, {
    email: 'user@gmail.com',
    password: '123456',
    fullName: 'Demo User',
    role: 'user',
    authProvider: 'local',
  })

  const district = await upsertDistrict(payload)

  const image1 = await createR2Media(payload, 'r2-demo-1.svg', 'R2 demo property image 1')
  const image2 = await createR2Media(payload, 'r2-demo-2.svg', 'R2 demo property image 2')
  const image3 = await createR2Media(payload, 'r2-demo-3.svg', 'R2 demo property image 3')
  const video = await createR2Media(payload, 'r2-demo-tour.mp4', 'R2 demo property video tour')

  const title = 'R2 Demo Property - Media upload bằng Cloudflare R2'
  const slug = slugify(title)
  const existingProperty = await findByField(payload, 'properties', 'slug', slug)
  const data = {
    title,
    slug,
    owner: demoUser.id,
    status: 'approved',
    type: 'apartment',
    price: 4560000000,
    area: 92,
    bedrooms: 3,
    bathrooms: 2,
    address: 'Cloudflare R2 Demo Street',
    district: district.id,
    images: [image1.id, image2.id, image3.id],
    videos: [video.id],
    description:
      'Tin demo dùng để kiểm tra Payload CMS upload ảnh/video example lên Cloudflare R2. Nếu R2 config đúng, media URL sẽ trỏ về R2_PUBLIC_URL/custom domain.',
    contactName: 'R2 Demo Admin',
    contactPhone: '0900000000',
    isVip: true,
    vipPackage: 'vip_30d',
    vipUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    boostedAt: new Date().toISOString(),
    metaTitle: `${title} | R2 Demo`,
    metaDescription: 'Tin demo để kiểm tra upload media lên Cloudflare R2 từ Payload CMS.',
    canonicalPath: `/?property=${slug}`,
    ogImage: image1.id,
    submittedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: adminUser.id,
    publishedAt: new Date().toISOString(),
  }

  const property = existingProperty
    ? await payload.update({ collection: 'properties', id: existingProperty.id, data, overrideAccess: true })
    : await payload.create({ collection: 'properties', data, overrideAccess: true })

  const mediaDocs = [image1, image2, image3, video]
  console.log('R2 seed completed.')
  console.log(JSON.stringify({
    property: { id: property.id, slug: property.slug, title: property.title },
    media: mediaDocs.map((doc) => ({ id: doc.id, filename: doc.filename, url: mediaUrl(doc), publicUrl: doc.publicUrl })),
    r2: {
      enabled: process.env.R2_ENABLED === 'true',
      bucket: process.env.R2_BUCKET,
      publicUrl: process.env.R2_PUBLIC_URL,
    },
  }, null, 2))

  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
