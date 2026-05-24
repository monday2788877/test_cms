import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

type DistrictDoc = {
  id: string
  name?: string
  city?: string
  code?: string
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get('limit') || 100)

  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'districts',
      limit: Number.isFinite(limit) ? limit : 100,
      sort: 'city,name',
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({
      ...result,
      docs: (result.docs as DistrictDoc[]).map((doc) => ({
        id: doc.id,
        name: doc.name,
        city: doc.city,
        code: doc.code,
      })),
    })
  } catch (error) {
    console.error('[public-districts] failed', error)
    return NextResponse.json(
      {
        docs: [],
        totalDocs: 0,
        limit,
        totalPages: 0,
        page: 1,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
