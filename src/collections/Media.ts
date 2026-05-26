import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

const MB = 1024 * 1024
const MAX_IMAGE_UPLOAD_MB = Number(process.env.MAX_IMAGE_UPLOAD_MB || 0)
const MAX_VIDEO_UPLOAD_MB = Number(process.env.MAX_VIDEO_UPLOAD_MB || 0)
const MAX_IMAGE_BYTES = MAX_IMAGE_UPLOAD_MB > 0 ? MAX_IMAGE_UPLOAD_MB * MB : 0
const MAX_VIDEO_BYTES = MAX_VIDEO_UPLOAD_MB > 0 ? MAX_VIDEO_UPLOAD_MB * MB : 0

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

  const publicBase = (process.env.R2_PUBLIC_URL || process.env.MEDIA_PUBLIC_URL || '').replace(/\/$/, '')
  if (publicBase && !data.publicUrl && data.filename) {
    data.publicUrl = `${publicBase}/${data.filename}`
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

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'video/*'],
    adminThumbnail: 'thumb',
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
