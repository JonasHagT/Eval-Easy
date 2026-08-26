import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['xlsx', 'pdf-parse', 'jszip'],
}

export default nextConfig
