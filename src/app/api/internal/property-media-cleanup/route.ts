import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

type CleanupBody = {
  propertyId?: string | number
  mediaIds?: Array<string | number>
}

type R2DeleteResult = {
  enabled: boolean
  deletedKeys: string[]
  failedKeys: Array<{ key: string; error: string }>
}

function getCleanupToken() {
  return process.env.CMS_INTERNAL_CLEANUP_TOKEN || process.env.INTERNAL_API_TOKEN || process.env.ADMIN_INTERNAL_TOKEN || ''
}

function normalizeIds(value: unknown): Array<string | number> {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const ids: Array<string | number> = []

  for (const item of value) {
    if (typeof item !== 'string' && typeof item !== 'number') continue
    const key = String(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    ids.push(item)
  }

  return ids
}

function isNotFoundError(error: unknown) {
  const anyError = error as { status?: number; statusCode?: number; message?: string }
  return anyError?.status === 404 || anyError?.statusCode === 404 || String(anyError?.message || '').toLowerCase().includes('not found')
}

function compactString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function objectKeyPrefix() {
  return compactString(process.env.R2_KEY_PREFIX || process.env.S3_KEY_PREFIX).replace(/^\/+|\/+$/g, '')
}

function withPrefix(key: string) {
  const prefix = objectKeyPrefix()
  const cleanKey = key.replace(/^\/+/, '')
  if (!prefix) return cleanKey
  if (cleanKey === prefix || cleanKey.startsWith(`${prefix}/`)) return cleanKey
  return `${prefix}/${cleanKey}`
}

function collectKeyFromUrl(urlValue: unknown, keys: Set<string>) {
  const value = compactString(urlValue)
  if (!value) return

  const publicBase = compactString(process.env.R2_PUBLIC_URL || process.env.MEDIA_PUBLIC_URL).replace(/\/$/, '')

  try {
    // Chỉ suy ra key từ public R2/custom domain. Không lấy URL local kiểu /api/media/file/*
    // vì path đó không phải object key chắc chắn trên R2.
    if (publicBase && value.startsWith(`${publicBase}/`)) {
      const key = decodeURIComponent(value.slice(publicBase.length + 1)).replace(/^\/+/, '')
      if (key) keys.add(key)
      return
    }

    const parsed = new URL(value)
    if (publicBase) {
      const parsedBase = new URL(publicBase)
      if (parsed.host === parsedBase.host) {
        const key = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
        if (key) keys.add(key)
      }
    }
  } catch {
    // Relative URL không đủ tin cậy để suy ra R2 key, bỏ qua.
  }
}

function collectR2ObjectKeys(mediaDoc: any) {
  const keys = new Set<string>()

  const addFilename = (filename: unknown) => {
    const value = compactString(filename)
    if (value) keys.add(withPrefix(value))
  }

  addFilename(mediaDoc?.filename)
  collectKeyFromUrl(mediaDoc?.publicUrl, keys)
  collectKeyFromUrl(mediaDoc?.url, keys)
  collectKeyFromUrl(mediaDoc?.thumbnailURL, keys)

  const sizes = mediaDoc?.sizes && typeof mediaDoc.sizes === 'object' ? mediaDoc.sizes : {}
  for (const size of Object.values(sizes) as any[]) {
    addFilename(size?.filename)
    collectKeyFromUrl(size?.url, keys)
    collectKeyFromUrl(size?.publicUrl, keys)
  }

  return Array.from(keys).filter(Boolean)
}

function getR2Client() {
  if (process.env.R2_ENABLED !== 'true') return null

  const bucket = compactString(process.env.R2_BUCKET)
  const endpoint = compactString(
    process.env.R2_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : ''),
  )
  const accessKeyId = compactString(process.env.R2_ACCESS_KEY_ID)
  const secretAccessKey = compactString(process.env.R2_SECRET_ACCESS_KEY)

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null

  return {
    bucket,
    client: new S3Client({
      endpoint,
      region: process.env.R2_REGION || 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  }
}

async function deleteR2Objects(keys: string[]): Promise<R2DeleteResult> {
  const setup = getR2Client()
  if (!setup || keys.length === 0) {
    return { enabled: Boolean(setup), deletedKeys: [], failedKeys: [] }
  }

  const deletedKeys: string[] = []
  const failedKeys: Array<{ key: string; error: string }> = []
  const uniqueKeys = Array.from(new Set(keys)).filter(Boolean)

  for (let index = 0; index < uniqueKeys.length; index += 1000) {
    const chunk = uniqueKeys.slice(index, index + 1000)
    try {
      const result = await setup.client.send(
        new DeleteObjectsCommand({
          Bucket: setup.bucket,
          Delete: {
            Quiet: false,
            Objects: chunk.map((Key) => ({ Key })),
          },
        }),
      )

      for (const item of result.Deleted || []) {
        if (item.Key) deletedKeys.push(item.Key)
      }
      for (const item of result.Errors || []) {
        failedKeys.push({
          key: item.Key || '',
          error: item.Message || item.Code || 'Unknown R2 delete error',
        })
      }

      // R2/S3 DeleteObjects coi xóa object không tồn tại là thành công, nhưng một số adapter
      // có thể không trả Deleted đầy đủ. Đánh dấu các key chưa có trong Errors là đã xử lý.
      const errorKeys = new Set((result.Errors || []).map((item) => item.Key).filter(Boolean))
      for (const key of chunk) {
        if (!errorKeys.has(key) && !deletedKeys.includes(key)) deletedKeys.push(key)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failedKeys.push(...chunk.map((key) => ({ key, error: message })))
    }
  }

  return { enabled: true, deletedKeys, failedKeys }
}

export async function POST(request: Request) {
  const expectedToken = getCleanupToken()
  const providedToken = request.headers.get('x-internal-token') || ''

  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json({ ok: false, error: 'Unauthorized cleanup request' }, { status: 401 })
  }

  let body: CleanupBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const mediaIds = normalizeIds(body.mediaIds)
  if (mediaIds.length === 0) {
    return NextResponse.json({ ok: true, deleted: [], failed: [], skipped: true })
  }

  const payload = await getPayload({ config })
  const deleted: Array<string | number> = []
  const missing: Array<string | number> = []
  const failed: Array<{ id: string | number; error: string }> = []
  const r2DeletedKeys: string[] = []
  const r2FailedKeys: Array<{ id: string | number; key: string; error: string }> = []

  for (const id of mediaIds) {
    try {
      let mediaDoc: any = null
      try {
        mediaDoc = await payload.findByID({
          collection: 'media',
          id,
          depth: 0,
          overrideAccess: true,
          disableTransaction: true,
        } as any)
      } catch (error) {
        if (isNotFoundError(error)) {
          missing.push(id)
          continue
        }
        throw error
      }

      // Xóa trực tiếp object R2 trước khi xóa document media.
      // Lý do: một số cấu hình storage-s3/Payload có thể xóa DB doc nhưng không cleanup object R2.
      const objectKeys = collectR2ObjectKeys(mediaDoc)
      const r2Result = await deleteR2Objects(objectKeys)
      r2DeletedKeys.push(...r2Result.deletedKeys)
      r2FailedKeys.push(...r2Result.failedKeys.map((item) => ({ id, ...item })))

      await payload.delete({
        collection: 'media',
        id,
        overrideAccess: true,
        // Không để xóa file media/R2 nằm trong transaction DB lâu.
        // Tránh lỗi PostgreSQL idle-in-transaction timeout khi storage/network chậm.
        disableTransaction: true,
      } as any)
      deleted.push(id)
    } catch (error) {
      if (isNotFoundError(error)) {
        missing.push(id)
        continue
      }

      const message = error instanceof Error ? error.message : String(error)
      failed.push({ id, error: message })
      console.error(
        `[property-media-cleanup] failed to delete media ${String(id)} after deleting property ${String(body.propertyId || '')}:`,
        error,
      )
    }
  }

  return NextResponse.json({
    ok: failed.length === 0 && r2FailedKeys.length === 0,
    propertyId: body.propertyId ?? null,
    deleted,
    missing,
    failed,
    r2: {
      enabled: process.env.R2_ENABLED === 'true',
      deletedKeys: Array.from(new Set(r2DeletedKeys)),
      failedKeys: r2FailedKeys,
    },
  })
}
