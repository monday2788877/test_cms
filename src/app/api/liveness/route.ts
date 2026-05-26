import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'payload-cms',
    type: 'liveness',
    checkedAt: new Date().toISOString(),
  })
}
