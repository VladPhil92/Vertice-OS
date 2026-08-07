const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // `serverExternalPackages` (sin prefijo experimental) solo existe desde
    // Next.js 15. En 14.x la clave correcta es esta: usar la otra hacía que
    // Next la ignorara con "Unrecognized key(s) in object" y mapbox-gl NO
    // quedara externalizado — justo lo contrario de lo que se pretendía.
    serverComponentsExternalPackages: ['mapbox-gl'],
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
