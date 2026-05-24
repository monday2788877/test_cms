import config from '@payload-config'
import { NotFoundPage } from '@payloadcms/next/views'
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

export default async function NotFound(args: Args = {}) {
  return NotFoundPage({
    config,
    importMap,
    params: normalizeParams(args.params),
    searchParams: normalizeSearchParams(args.searchParams),
  })
}
