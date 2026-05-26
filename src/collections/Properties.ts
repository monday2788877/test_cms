import type { Access, CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { DEFAULT_APP_CONFIG } from './AppConfigs'

const FAIL_CLOSED_APP_CONFIG = {
  ...DEFAULT_APP_CONFIG,
  allowUserRegistration: false,
  allowGoogleLogin: false,
  allowGoogleAutoCreateUser: false,
  allowUserCreateProperty: false,
  allowUserEditProperty: false,
  autoApproveUserProperties: false,
  maxPendingPropertiesPerUser: 0,
}

const propertyStatuses = [
  { label: 'Draft', value: 'draft' },
  { label: 'Pending approval', value: 'pending' },
  { label: 'Approved / Public', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'Pending delete', value: 'pending_delete' },
] as const

const isAdminUser = (user: any) => user?.role === 'admin'

const readAccess: Access = ({ req }) => {
  const user = req.user as any
  if (isAdminUser(user)) return true

  if (user?.id) {
    return {
      or: [
        { status: { equals: 'approved' } },
        { owner: { equals: user.id } },
      ],
    }
  }

  return { status: { equals: 'approved' } }
}

const createAccess: Access = ({ req }) => Boolean(req.user)

const updateAccess: Access = ({ req }) => {
  const user = req.user as any
  if (isAdminUser(user)) return true
  if (!user?.id) return false

  return { owner: { equals: user.id } }
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

function idsCount(value: any) {
  if (!value) return 0
  if (!Array.isArray(value)) return 1
  return value.filter(Boolean).length
}

function relationId(value: any) {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value.id) return String(value.id)
  if (value.value) return String(value.value)
  return null
}

async function mediaTotalBytes(req: any, value: any) {
  if (!value) return 0
  const items = Array.isArray(value) ? value : [value]
  let total = 0
  for (const item of items) {
    if (item?.filesize) {
      total += Number(item.filesize || 0)
      continue
    }
    const id = relationId(item)
    if (!id) continue
    try {
      const media = await req.payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true })
      total += Number(media?.filesize || 0)
    } catch {
      // Payload will handle invalid relationship ids later; this guard only computes known filesize.
    }
  }
  return total
}

async function getAppConfig(req: any) {
  try {
    const result = await req.payload.find({
      collection: 'app-configs',
      where: { key: { equals: 'default' } },
      limit: 1,
      overrideAccess: true,
    })
    const doc = result.docs?.[0]
    if (!doc) return FAIL_CLOSED_APP_CONFIG
    const limits = doc?.limits || {}
    const permissions = doc?.permissions || {}
    return {
      ...DEFAULT_APP_CONFIG,
      ...limits,
      ...permissions,
    }
  } catch {
    return FAIL_CLOSED_APP_CONFIG
  }
}

async function countPendingProperties(req: any, userId: string | number) {
  const result = await req.payload.find({
    collection: 'properties',
    where: {
      and: [
        { owner: { equals: String(userId) } },
        { status: { equals: 'pending' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return Number(result.totalDocs || 0)
}


function collectRelationIds(value: any): Array<string | number> {
  if (!value) return []
  const items = Array.isArray(value) ? value : [value]
  return items
    .map((item) => {
      if (!item) return null
      if (typeof item === 'string' || typeof item === 'number') return item
      if (typeof item.id === 'string' || typeof item.id === 'number') return item.id
      if (typeof item.value === 'string' || typeof item.value === 'number') return item.value
      return null
    })
    .filter((id): id is string | number => id !== null)
}

function cleanupEndpointBaseURL(req: any) {
  const configured = process.env.CMS_INTERNAL_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || ''
  if (configured) return configured.replace(/\/$/, '')

  const host = req?.headers?.get?.('host')
  const proto = req?.headers?.get?.('x-forwarded-proto') || 'http'
  if (host) return `${proto}://${host}`

  return ''
}

const deleteRelatedMedia: CollectionAfterDeleteHook = ({ doc, req }) => {
  const mediaIds = new Map<string, string | number>()

  for (const id of collectRelationIds(doc?.images)) {
    mediaIds.set(String(id), id)
  }
  for (const id of collectRelationIds(doc?.videos)) {
    mediaIds.set(String(id), id)
  }

  if (mediaIds.size === 0) return doc

  const propertyId = doc?.id
  const ids = Array.from(mediaIds.values())
  const token = process.env.CMS_INTERNAL_CLEANUP_TOKEN || process.env.INTERNAL_API_TOKEN || process.env.ADMIN_INTERNAL_TOKEN || ''
  const baseURL = cleanupEndpointBaseURL(req)

  if (!token || !baseURL) {
    console.error(
      `[property-media-cleanup] skipped for property ${String(propertyId || '')}: missing CMS_INTERNAL_CLEANUP_TOKEN/INTERNAL_API_TOKEN or CMS_INTERNAL_URL/PAYLOAD_PUBLIC_SERVER_URL`,
    )
    return doc
  }

  // Rất quan trọng: không dùng req.payload.delete() ngay trong hook.
  // Payload/Drizzle/Postgres có thể giữ transaction context qua timer/AsyncLocalStorage,
  // dẫn tới idle-in-transaction timeout khi xóa media/R2 chậm.
  // Hook chỉ bắn một HTTP request nội bộ sang route cleanup riêng để chạy trong request/transaction mới,
  // và không await để modal Delete của Payload Admin đóng ngay.
  setTimeout(() => {
    fetch(`${baseURL}/api/internal/property-media-cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': token,
      },
      body: JSON.stringify({ propertyId, mediaIds: ids }),
    }).catch((error) => {
      console.error(`[property-media-cleanup] failed to enqueue property ${String(propertyId || '')}:`, error)
    })
  }, 0)

  return doc
}

const syncSearchIndex: CollectionAfterChangeHook = async ({ doc }) => {
  const enabled = process.env.SEARCH_SYNC_ENABLED !== 'false'
  const publicApiURL = process.env.PUBLIC_API_INTERNAL_URL || process.env.PUBLIC_API_URL || 'http://public-api:4000'
  const internalToken = process.env.INTERNAL_API_TOKEN || process.env.ADMIN_INTERNAL_TOKEN
  if (!enabled || !doc?.id || !publicApiURL || !internalToken) return doc

  try {
    await fetch(`${publicApiURL.replace(/\/$/, '')}/api/search/sync-property`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': internalToken,
      },
      body: JSON.stringify({ id: String(doc.id) }),
    })
  } catch (error) {
    // Không chặn admin lưu tin nếu search index đang lỗi. Có thể reindex lại bằng endpoint ops.
    console.error('Search sync failed:', error)
  }

  return doc
}

const normalizeApprovalFlow: CollectionBeforeChangeHook = async ({ req, operation, data, originalDoc }) => {
  const user = req.user as any
  const now = new Date().toISOString()
  const appConfig = await getAppConfig(req)

  const images = data.images ?? originalDoc?.images ?? []
  const videos = data.videos ?? originalDoc?.videos ?? []

  if (idsCount(images) > Number(appConfig.maxImagesPerProperty)) {
    throw new Error(`Một tin chỉ được phép có tối đa ${appConfig.maxImagesPerProperty} ảnh.`)
  }

  if (idsCount(videos) > Number(appConfig.maxVideosPerProperty)) {
    throw new Error(`Một tin chỉ được phép có tối đa ${appConfig.maxVideosPerProperty} video.`)
  }

  const mb = 1024 * 1024
  const [imageBytes, videoBytes] = await Promise.all([mediaTotalBytes(req, images), mediaTotalBytes(req, videos)])
  if (imageBytes > Number(appConfig.maxImageUploadMbPerProperty) * mb) {
    throw new Error(`Tổng dung lượng ảnh vượt quá ${appConfig.maxImageUploadMbPerProperty}MB/tin.`)
  }
  if (videoBytes > Number(appConfig.maxVideoUploadMbPerProperty) * mb) {
    throw new Error(`Tổng dung lượng video vượt quá ${appConfig.maxVideoUploadMbPerProperty}MB/tin.`)
  }

  if (!data.slug && data.title) {
    data.slug = `${slugify(String(data.title))}-${Date.now()}`
  }

  if (user?.id && !isAdminUser(user)) {
    data.owner = user.id
    const keys = Object.keys(data || {}).filter((key) => !['updatedAt', 'owner'].includes(key))
    const vipOnlyUpdate = keys.length > 0 && keys.every((key) => ['isVip', 'vipPackage', 'vipUntil', 'boostedAt'].includes(key))
    if (vipOnlyUpdate) {
      throw new Error('User không được tự cập nhật trường VIP. Việc này phải đi qua Public API payment/subscription flow.')
    }

    if (operation === 'create') {
      if (!appConfig.allowUserCreateProperty) {
        throw new Error('Admin đang tắt chức năng user đăng tin.')
      }

      const pendingCount = await countPendingProperties(req, user.id)
      if (pendingCount >= Number(appConfig.maxPendingPropertiesPerUser)) {
        throw new Error(`Bạn đã có ${pendingCount} tin đang chờ duyệt. Giới hạn hiện tại là ${appConfig.maxPendingPropertiesPerUser} tin.`)
      }

      data.status = appConfig.autoApproveUserProperties ? 'approved' : 'pending'
      data.submittedAt = now
      if (data.status === 'approved') {
        data.publishedAt = now
        data.approvedAt = now
      }
    }

    if (operation === 'update') {
      if (originalDoc?.status === 'pending_delete') {
        throw new Error('Tin đang chờ admin duyệt xóa, user không thể chỉnh sửa hoặc gửi duyệt lại.')
      }

      if (!appConfig.allowUserEditProperty) {
        throw new Error('Admin đang tắt chức năng user chỉnh sửa tin.')
      }

      data.status = appConfig.autoApproveUserProperties ? 'approved' : 'pending'
      data.submittedAt = now
      data.approvedAt = data.status === 'approved' ? now : null
      data.approvedBy = null
      data.rejectReason = null
      data.publishedAt = data.status === 'approved' ? now : null
    }
  }

  if (isAdminUser(user)) {
    if (data.status === 'approved' && originalDoc?.status !== 'approved') {
      data.approvedAt = now
      data.approvedBy = user.id
      data.publishedAt = data.publishedAt || now
      data.rejectReason = null
      data.rejectedAt = null
    }

    if (data.status === 'rejected') {
      if (!data.rejectReason) {
        throw new Error('Admin cần nhập lý do từ chối trước khi chuyển tin sang rejected.')
      }
      data.rejectedAt = now
      data.publishedAt = null
    }

    if (data.status === 'hidden') {
      data.publishedAt = null
    }

    if (data.status === 'pending_delete') {
      data.publishedAt = null
      data.rejectReason = null
      data.rejectedAt = null
    }
  }


  // Phase 2: SEO defaults. Admin vẫn có thể chỉnh tay trong Payload.
  if (data.title && !data.metaTitle) {
    data.metaTitle = `${String(data.title).slice(0, 68)} | Real Estate Hybrid`
  }
  if ((data.description || originalDoc?.description) && !data.metaDescription) {
    data.metaDescription = String(data.description || originalDoc?.description).replace(/\s+/g, ' ').slice(0, 155)
  }
  if (!data.canonicalPath && (data.slug || originalDoc?.slug)) {
    data.canonicalPath = `/?property=${data.slug || originalDoc?.slug}`
  }

  return data
}

export const Properties: CollectionConfig = {
  slug: 'properties',
  labels: {
    singular: 'Property',
    plural: 'Properties',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'owner', 'price', 'district', 'isVip', 'vipUntil', 'updatedAt'],
    group: 'Real Estate',
  },
  access: {
    read: readAccess,
    create: createAccess,
    update: updateAccess,
    delete: ({ req }) => isAdminUser(req.user),
  },
  hooks: {
    beforeChange: [normalizeApprovalFlow],
    afterChange: [syncSearchIndex],
    afterDelete: [deleteRelatedMedia],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'User đăng tin. Nếu admin tạo tin thì có thể chọn owner hoặc để trống.',
      },
      access: {
        update: ({ req }) => isAdminUser(req.user),
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: propertyStatuses as any,
      admin: {
        description: 'User đăng tin sẽ vào pending. User yêu cầu xóa sẽ vào pending_delete; admin review rồi xóa thật nếu đồng ý.',
      },
      access: {
        update: ({ req }) => isAdminUser(req.user),
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'apartment',
      options: [
        { label: 'Chung cư', value: 'apartment' },
        { label: 'Nhà riêng', value: 'house' },
        { label: 'Đất nền', value: 'land' },
        { label: 'Biệt thự', value: 'villa' },
      ],
    },
    { name: 'price', type: 'number', required: true, min: 0 },
    { name: 'area', type: 'number', required: true, min: 1 },
    { name: 'bedrooms', type: 'number', min: 0, defaultValue: 2 },
    { name: 'bathrooms', type: 'number', min: 0, defaultValue: 2 },
    { name: 'address', type: 'text', required: true },
    {
      name: 'district',
      type: 'relationship',
      relationTo: 'districts',
      required: true,
    },
    {
      name: 'images',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      required: false,
      admin: {
        description: 'Số lượng ảnh được validate theo App Config.',
      },
    },
    {
      name: 'videos',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      required: false,
      admin: {
        description: 'Số lượng video được validate theo App Config.',
      },
    },
    { name: 'description', type: 'textarea', required: true },
    { name: 'contactName', type: 'text', required: true },
    { name: 'contactPhone', type: 'text', required: true },
    {
      name: 'isVip',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Phase 3: tin VIP được ưu tiên sắp xếp public.' },
      access: { update: ({ req }) => isAdminUser(req.user) },
    },
    {
      name: 'vipPackage',
      type: 'text',
      label: 'Mã gói VIP',
      admin: { description: 'Được NestJS cập nhật khi user mua gói VIP mock/payment.' },
      access: { update: ({ req }) => isAdminUser(req.user) },
    },
    {
      name: 'vipUntil',
      type: 'date',
      label: 'VIP đến ngày',
      admin: { description: 'Tin sẽ được coi là VIP đến thời điểm này.' },
      access: { update: ({ req }) => isAdminUser(req.user) },
    },
    {
      name: 'boostedAt',
      type: 'date',
      label: 'Đẩy tin gần nhất',
      admin: { description: 'Dùng để sắp xếp tin VIP/đẩy tin.' },
      access: { update: ({ req }) => isAdminUser(req.user) },
    },
    { name: 'rejectReason', type: 'textarea', label: 'Lý do từ chối', admin: { condition: (_, siblingData) => siblingData?.status === 'rejected', description: 'Bắt buộc khi admin chuyển status sang rejected. User sẽ thấy nội dung này để sửa lại.' } },
    { name: 'reviewNotes', type: 'textarea', label: 'Ghi chú duyệt nội bộ', admin: { description: 'Ghi chú chỉ dành cho admin khi review tin.' } },
    { name: 'metaTitle', type: 'text', label: 'SEO meta title', maxLength: 70, admin: { description: 'Phase 2: title cho trang chi tiết và Open Graph.' } },
    { name: 'metaDescription', type: 'textarea', label: 'SEO meta description', maxLength: 170 },
    { name: 'canonicalPath', type: 'text', label: 'SEO canonical path', admin: { placeholder: '/?property=slug-tin-bds' } },
    { name: 'ogImage', type: 'relationship', relationTo: 'media', label: 'SEO Open Graph image' },
    { name: 'submittedAt', type: 'date' },
    { name: 'approvedAt', type: 'date' },
    { name: 'rejectedAt', type: 'date' },
    { name: 'approvedBy', type: 'relationship', relationTo: 'users' },
    { name: 'publishedAt', type: 'date' },
    {
      name: 'deletionRequestedAt',
      type: 'date',
      label: 'Thời điểm user yêu cầu xóa',
      admin: { condition: (_, siblingData) => siblingData?.status === 'pending_delete' },
    },
    {
      name: 'deletionRequestedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'User yêu cầu xóa',
      admin: { condition: (_, siblingData) => siblingData?.status === 'pending_delete' },
    },
    {
      name: 'deletionReason',
      type: 'textarea',
      label: 'Lý do user yêu cầu xóa',
      admin: { condition: (_, siblingData) => siblingData?.status === 'pending_delete' },
    },
  ],
}
