import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckResult = {
  ok: boolean
  name: string
  status?: number
  latencyMs?: number
  error?: string
}

const CHECK_TIMEOUT_MS = Number(process.env.CMS_HEALTH_CHECK_TIMEOUT_MS || 2500)
const TOTAL_TIMEOUT_MS = Number(process.env.CMS_HEALTH_TOTAL_TIMEOUT_MS || 7000)

function timeoutResult(name: string, started: number, ms: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: false,
        name,
        latencyMs: Date.now() - started,
        error: `Health check timed out after ${ms}ms`,
      })
    }, ms)
  })
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, onTimeout: () => T): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function checkCollection(payload: any, collection: string): Promise<CheckResult> {
  const started = Date.now()

  return withTimeout(
    (async () => {
      try {
        await payload.find({
          collection,
          limit: 1,
          depth: 0,
          overrideAccess: true,
          disableTransaction: true,
        } as any)
        return { ok: true, name: collection, latencyMs: Date.now() - started }
      } catch (error) {
        return {
          ok: false,
          name: collection,
          latencyMs: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })(),
    CHECK_TIMEOUT_MS,
    () => ({
      ok: false,
      name: collection,
      latencyMs: Date.now() - started,
      error: `Collection check timed out after ${CHECK_TIMEOUT_MS}ms`,
    }),
  )
}

export async function GET() {
  const started = Date.now()

  return withTimeout(
    (async () => {
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
    })(),
    TOTAL_TIMEOUT_MS,
    () =>
      NextResponse.json(
        {
          ok: false,
          service: 'payload-cms',
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          error: `CMS health timed out after ${TOTAL_TIMEOUT_MS}ms`,
        },
        { status: 503 },
      ),
  )
}
