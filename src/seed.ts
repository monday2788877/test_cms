import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from './payload.config'
import { DEFAULT_APP_CONFIG } from './collections/AppConfigs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const assetsDir = path.resolve(dirname, '../seed-assets')

const districts = [
  { name: 'Cầu Giấy', city: 'Hà Nội', code: 'cau-giay' },
  { name: 'Nam Từ Liêm', city: 'Hà Nội', code: 'nam-tu-liem' },
  { name: 'Long Biên', city: 'Hà Nội', code: 'long-bien' },
  { name: 'Quận 1', city: 'TP. Hồ Chí Minh', code: 'quan-1' },
  { name: 'Thủ Đức', city: 'TP. Hồ Chí Minh', code: 'thu-duc' },
]

const properties = [
  ['Chung cư cao cấp view hồ tại Cầu Giấy', 'apartment', 4350000000, 86, 3, 'Đường Duy Tân, Cầu Giấy'],
  ['Nhà phố 5 tầng gần mặt đường Nam Từ Liêm', 'house', 8200000000, 62, 4, 'Mỹ Đình, Nam Từ Liêm'],
  ['Biệt thự sân vườn khu đô thị Long Biên', 'villa', 18500000000, 220, 5, 'Vinhomes Riverside, Long Biên'],
  ['Căn hộ studio trung tâm Quận 1', 'apartment', 3200000000, 42, 1, 'Nguyễn Thị Minh Khai, Quận 1'],
  ['Đất nền sổ đỏ khu dân cư Thủ Đức', 'land', 5900000000, 95, 0, 'Đường số 12, Thủ Đức'],
  ['Chung cư 2 phòng ngủ full nội thất', 'apartment', 2750000000, 68, 2, 'Trần Thái Tông, Cầu Giấy'],
  ['Nhà riêng ngõ ô tô tránh, kinh doanh tốt', 'house', 12500000000, 88, 5, 'Lê Đức Thọ, Nam Từ Liêm'],
  ['Biệt thự song lập gần công viên', 'villa', 23000000000, 260, 5, 'Khu đô thị Việt Hưng, Long Biên'],
  ['Căn hộ cao cấp gần phố đi bộ', 'apartment', 6900000000, 78, 2, 'Lê Thánh Tôn, Quận 1'],
  ['Đất nền mặt tiền đường lớn', 'land', 7600000000, 120, 0, 'Hiệp Bình Chánh, Thủ Đức'],
  ['Penthouse duplex view thành phố', 'apartment', 15800000000, 180, 4, 'Keangnam, Nam Từ Liêm'],
  ['Nhà phố thương mại shophouse', 'house', 31000000000, 160, 4, 'Vinhomes Ocean Park, Long Biên'],
] as const

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

async function upsertDistrict(payload: any, data: any) {
  const existing = await findByField(payload, 'districts', 'code', data.code)
  if (existing) return existing
  return payload.create({ collection: 'districts', data, overrideAccess: true })
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
    notes: 'Admin có thể chỉnh giới hạn ảnh/video, đăng ký user, đăng nhập Google/Gmail, đăng bài và sửa bài tại đây.',
  }
  if (existing) {
    return payload.update({ collection: 'app-configs', id: existing.id, data, overrideAccess: true })
  }
  return payload.create({ collection: 'app-configs', data, overrideAccess: true })
}

async function createMedia(payload: any, fileName: string, alt: string) {
  const existing = await findByField(payload, 'media', 'filename', fileName)
  if (existing) return existing
  return payload.create({
    collection: 'media',
    data: { alt },
    filePath: path.join(assetsDir, fileName),
    overrideAccess: true,
  })
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

async function main() {
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

  const districtDocs = []
  for (const district of districts) {
    districtDocs.push(await upsertDistrict(payload, district))
  }

  for (let i = 0; i < properties.length; i++) {
    const [title, type, price, area, bedrooms, address] = properties[i]
    const slug = slugify(title)
    const existing = await findByField(payload, 'properties', 'slug', slug)
    if (existing) continue

    const image1 = await createMedia(payload, `property-${(i % 6) + 1}-1.svg`, `${title} ảnh 1`)
    const image2 = await createMedia(payload, `property-${(i % 6) + 1}-2.svg`, `${title} ảnh 2`)
    const video = await createMedia(payload, 'sample-tour.mp4', `${title} video tour`)

    await payload.create({
      collection: 'properties',
      overrideAccess: true,
      data: {
        title,
        slug,
        owner: demoUser.id,
        status: i < 8 ? 'approved' : i < 11 ? 'pending' : 'rejected',
        type,
        price,
        area,
        bedrooms,
        bathrooms: bedrooms ? Math.max(1, Math.min(4, bedrooms - 1)) : 0,
        address,
        district: districtDocs[i % districtDocs.length].id,
        images: [image1.id, image2.id],
        videos: [video.id],
        description:
          'Tin bất động sản demo được tạo tự động. Dữ liệu dùng để test luồng Payload Admin, NestJS Public API, frontend React và media storage.',
        contactName: i % 2 === 0 ? 'Nguyễn Minh Anh' : 'Trần Gia Bảo',
        contactPhone: i % 2 === 0 ? '0912345678' : '0987654321',
        isVip: i % 3 === 0,
        vipPackage: i % 3 === 0 ? 'vip_30d' : undefined,
        vipUntil: i % 3 === 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        boostedAt: i % 3 === 0 ? new Date().toISOString() : undefined,
        metaTitle: `${title} | Real Estate Hybrid`,
        metaDescription: `Thông tin ${title}, diện tích ${area} m², giá ${price.toLocaleString('vi-VN')} VND. Dữ liệu demo cho SEO, sitemap và Open Graph.`,
        canonicalPath: `/?property=${slug}`,
        ogImage: image1.id,
        rejectReason: i === 11 ? 'Tin demo bị từ chối để test flow admin duyệt.' : undefined,
        submittedAt: new Date().toISOString(),
        approvedAt: i < 8 ? new Date().toISOString() : undefined,
        approvedBy: i < 8 ? adminUser.id : undefined,
        publishedAt: i < 8 ? new Date().toISOString() : undefined,
      },
    })
  }

  console.log('Seed completed: app-config, admin/user, districts, media, properties, phase3 VIP demo fields')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
