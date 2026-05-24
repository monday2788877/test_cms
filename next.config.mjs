import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig = {
  reactStrictMode: true,
  // Allow dev access through reverse-proxy hostnames.
  allowedDevOrigins: ['localhost', '127.0.0.1', 'uat-agreement.tpbs.com.vn'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

export default withPayload(nextConfig)
