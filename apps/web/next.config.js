const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Moved from experimental.serverComponentsExternalPackages (deprecated in Next.js 14.1)
  serverExternalPackages: ['mapbox-gl'],
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  images: {
    // remotePatterns replaces deprecated images.domains
    remotePatterns: [
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud' },
    ],
  },
  env: {
    NEXT_PUBLIC_MAPBOX_TOKEN:  process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_API_URL:       process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL:        process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_POLYGON_RPC:   process.env.NEXT_PUBLIC_POLYGON_RPC,
    NEXT_PUBLIC_SENTRY_DSN:    process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  // Security headers and CSP are handled by middleware.ts (nonce-based, per-request)
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
