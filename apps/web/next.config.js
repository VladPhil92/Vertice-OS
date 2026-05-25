const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['mapbox-gl'],
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  images: {
    domains: ['ipfs.io', 'gateway.pinata.cloud'],
  },
  env: {
    NEXT_PUBLIC_MAPBOX_TOKEN:  process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_API_URL:       process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL:        process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_POLYGON_RPC:   process.env.NEXT_PUBLIC_POLYGON_RPC,
    NEXT_PUBLIC_SENTRY_DSN:    process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  async headers() {
    return [
      {
        source: '/dashboard/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://*.sentry.io",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.mapbox.com https://ipfs.io",
              "connect-src 'self' https://*.mapbox.com wss: ws: https://*.sentry.io",
              "worker-src blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Upload source maps in CI only — never in local dev
  silent:           !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps:   true,
  disableLogger:    true,
  // Skip source map upload if DSN is not configured
  dryRun: !process.env.NEXT_PUBLIC_SENTRY_DSN,
});
