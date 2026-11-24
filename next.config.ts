import type { NextConfig } from 'next'

const privateHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
  { key: 'Vary', value: 'Cookie' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
]

const guardedPaths = [
  '/admin/:path*', '/dashboard/:path*', '/staff/:path*',
  '/burial-admin/:path*', '/complete-profile/:path*',
  '/office-reports/:path*', '/claims/:path*', '/appointments/:path*',
  '/staff-mfa', '/login', '/verification', '/api/:path*',
]

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['exporter-lily-shack.ngrok-free.dev'],
  experimental: { proxyClientMaxBodySize: '100mb' },
  async headers() {
    // Complements per-request Proxy headers: dynamic private documents may
    // never be stored by intermediate CDN/browser HTTP caches.
    return guardedPaths.map(source => ({ source, headers: privateHeaders }))
  },
}

export default nextConfig
