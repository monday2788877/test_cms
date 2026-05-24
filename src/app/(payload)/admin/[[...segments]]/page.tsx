import type { Metadata } from 'next'
import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap.js'

type Params = {
  segments?: string[]
}

type SearchParams = {
  [key: string]: string | string[] | undefined
}

type Args = {
  params?: Params | Promise<Params>
  searchParams?: SearchParams | Promise<SearchParams>
}

async function normalizeParams(params?: Args['params']): Promise<{ segments: string[] }> {
  const resolved = await Promise.resolve(params ?? {})
  return {
    ...resolved,
    segments: Array.isArray(resolved.segments) ? resolved.segments : [],
  }
}

async function normalizeSearchParams(searchParams?: Args['searchParams']): Promise<SearchParams> {
  return Promise.resolve(searchParams ?? {})
}

export async function generateMetadata({ params, searchParams }: Args): Promise<Metadata> {
  return generatePageMetadata({
    config,
    params: normalizeParams(params),
    searchParams: normalizeSearchParams(searchParams),
  })
}

export default async function Page({ params, searchParams }: Args) {
  return RootPage({
    config,
    importMap,
    params: normalizeParams(params),
    searchParams: normalizeSearchParams(searchParams),
  })
}
