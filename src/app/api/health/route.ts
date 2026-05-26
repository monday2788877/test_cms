import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

type CheckResult = {
  ok: boolean
  name: string
  status?: number
  latencyMs?: number
  error?: string
}

async function checkCollection(payload: any, collection: string): Promise<CheckResult> {
  const started = Date.now()
  try {
    await payload.find({ collection, limit: 1, depth: 0, overrideAccess: true })
    return { ok: true, name: collection, latencyMs: Date.now() - started }
  } catch (error) {
    return {
      ok: false,
      name: collection,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function GET() {
  const started = Date.now()

  try {
    const payload = await getPayload({ config })
    const checks = await Promise.all([
      checkCollection(payload, 'users'),
      checkCollection(payload, 'media'),
      checkCollection(payload, 'districts'),
      checkCollection(payload, 'properties'),
      checkCollection(payload, 'app-configs'),
    ])
    const ok = checks.every((check) => check.ok)

    return NextResponse.json(
      {
        ok,
        service: 'payload-cms',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        checks,
      },
      { status: ok ? 200 : 503 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: 'payload-cms',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    )
  }
}
