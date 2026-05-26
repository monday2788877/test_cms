import { NextResponse, type NextRequest } from 'next/server'

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4000',
  'https://uat-agreement.tpbs.com.vn',
  'https://testcms-production.up.railway.app',
]

const parseOrigins = (value?: string) =>
  (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const allowedOrigins = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...parseOrigins(process.env.CORS_ORIGINS),
  ...parseOrigins(process.env.CSRF_ORIGINS),
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.NEXT_PUBLIC_FRONTEND_URL),
  ...parseOrigins(process.env.PAYLOAD_PUBLIC_SERVER_URL),
  ...parseOrigins(process.env.NEXT_PUBLIC_SERVER_URL),
])

function isAllowedOrigin(origin: string) {
  if (allowedOrigins.has('*')) return true
  if (allowedOrigins.has(origin)) return true

  try {
    const host = new URL(origin).hostname
    return host === 'localhost' || host.endsWith('.tpbs.com.vn')
  } catch {
    return false
  }
}

function applyCorsHeaders(response: NextResponse, request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  if (!origin || !isAllowedOrigin(origin)) return response

  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Vary', 'Origin')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    request.headers.get('access-control-request-headers') || 'Content-Type, Authorization',
  )
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

export function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return applyCorsHeaders(new NextResponse(null, { status: 204 }), request)
  }

  return applyCorsHeaders(NextResponse.next(), request)
}

export const config = {
  matcher: ['/api/:path*'],
}
