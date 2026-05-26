import type { CollectionAfterReadHook, CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

const MB = 1024 * 1024
const MAX_IMAGE_UPLOAD_MB = Number(process.env.MAX_IMAGE_UPLOAD_MB || 0)
const MAX_VIDEO_UPLOAD_MB = Number(process.env.MAX_VIDEO_UPLOAD_MB || 0)
const MAX_IMAGE_BYTES = MAX_IMAGE_UPLOAD_MB > 0 ? MAX_IMAGE_UPLOAD_MB * MB : 0
const MAX_VIDEO_BYTES = MAX_VIDEO_UPLOAD_MB > 0 ? MAX_VIDEO_UPLOAD_MB * MB : 0

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, '')}/${String(path || '').replace(/^\//, '')}`
}

function mediaPublicBase() {
  return (process.env.R2_PUBLIC_URL || process.env.MEDIA_PUBLIC_URL || '').replace(/\/$/, '')
}

function derivePublicUrlFromFilename(filename?: unknown) {
  const base = mediaPublicBase()
  const value = String(filename || '').trim()
  if (!base || !value) return ''
  return joinUrl(base, value)
}

function fillDerivedPublicUrls(doc: any) {
  if (!doc) return doc
  const originalPublicUrl = derivePublicUrlFromFilename(doc.filename)
  if (originalPublicUrl && (!doc.publicUrl || String(doc.publicUrl).includes('/api/media/file/'))) {
    doc.publicUrl = originalPublicUrl
  }

  if (doc.sizes && typeof doc.sizes === 'object') {
    for (const size of Object.values(doc.sizes) as any[]) {
      if (!size || typeof size !== 'object') continue
      const sizePublicUrl = derivePublicUrlFromFilename(size.filename)
      if (sizePublicUrl && (!size.publicUrl || String(size.publicUrl).includes('/api/media/file/'))) {
        size.publicUrl = sizePublicUrl
      }
      if (sizePublicUrl && (!size.url || String(size.url).includes('/api/media/file/'))) {
        size.url = sizePublicUrl
      }
    }
  }

  return doc
}

const deriveMediaPublicUrls: CollectionAfterReadHook = ({ doc }) => fillDerivedPublicUrls(doc)

const setMediaOwner: CollectionBeforeChangeHook = ({ req, data, operation }) => {
  const user = req.user as any
  if (operation === 'create' && user?.id && !data.owner) {
    data.owner = user.id
  }
  const mimeType = String(data.mimeType || '')
  const filesize = Number(data.filesize || 0)
  if (MAX_IMAGE_BYTES > 0 && filesize > 0 && mimeType.startsWith('image/') && filesize > MAX_IMAGE_BYTES) {
    throw new Error(`Ảnh vượt quá giới hạn ${MAX_IMAGE_UPLOAD_MB}MB/file.`)
  }
  if (MAX_VIDEO_BYTES > 0 && filesize > 0 && mimeType.startsWith('video/') && filesize > MAX_VIDEO_BYTES) {
    throw new Error(`Video vượt quá giới hạn ${MAX_VIDEO_UPLOAD_MB}MB/file.`)
  }

  const publicUrl = derivePublicUrlFromFilename(data.filename)
  if (publicUrl && (!data.publicUrl || String(data.publicUrl).includes('/api/media/file/'))) {
    data.publicUrl = publicUrl
  }
  return data
}


const isAdminField = ({ req }: any): boolean => {
  return (req.user as any)?.role === 'admin'
}

const isAdminOrOwner = ({ req }: any) => {
  const user = req.user as any
  if (user?.role === 'admin') return true
  if (!user?.id) return false
  return { owner: { equals: user.id } }
}


const mediaAdminThumbnail = ({ doc }: { doc?: any }) => {
  // Prefer R2/CDN URL. Old media may only have local /api/media/file/* URL,
  // which can 404 on Railway when files are stored on R2.
  const normalized = fillDerivedPublicUrls({ ...(doc || {}) })
  return normalized?.publicUrl || normalized?.sizes?.thumb?.publicUrl || normalized?.url || normalized?.sizes?.thumb?.url || null
}

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'video/*'],
    adminThumbnail: mediaAdminThumbnail as any,
    imageSizes: [
      { name: 'thumb', width: 320, height: 240, position: 'centre' },
      { name: 'card', width: 768, height: 576, position: 'centre' },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
  },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'mimeType', 'filesize', 'owner', 'createdAt'],
    group: 'Real Estate',
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: isAdminOrOwner,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [setMediaOwner],
    afterRead: [deriveMediaPublicUrls],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'publicUrl',
      type: 'text',
      admin: {
        description: 'URL public CDN/R2 nếu dùng custom media domain. Local dev có thể để trống và dùng field url mặc định. Với production private media, nên thay bằng signed URL.',
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'User upload media. Admin có thể quản lý toàn bộ.',
      },
      access: {
        update: isAdminField,
      },
    },
  ],
}
