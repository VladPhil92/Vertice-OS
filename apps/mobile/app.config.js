const staticConfig = require('./app.json')

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizedVariant() {
  return (
    process.env.APP_VARIANT
    || process.env.EXPO_PUBLIC_RELEASE_CHANNEL
    || 'development'
  ).trim().toLowerCase()
}

function validateReleaseConfiguration({ variant, apiUrl, easProjectId, androidMapsKey }) {
  if (!['preview', 'production'].includes(variant)) return

  if (!apiUrl) {
    throw new Error(`[mobile-config] ${variant} requires EXPO_PUBLIC_API_URL`)
  }

  let parsedApiUrl
  try {
    parsedApiUrl = new URL(apiUrl)
  } catch {
    throw new Error(`[mobile-config] ${variant} EXPO_PUBLIC_API_URL must be a valid URL`)
  }

  if (parsedApiUrl.protocol !== 'https:' || LOCAL_HOSTS.has(parsedApiUrl.hostname)) {
    throw new Error(`[mobile-config] ${variant} EXPO_PUBLIC_API_URL must use HTTPS and a non-local hostname`)
  }

  if (!easProjectId || !UUID_RE.test(easProjectId)) {
    throw new Error(`[mobile-config] ${variant} requires a valid EAS_PROJECT_ID UUID`)
  }

  if (!androidMapsKey) {
    throw new Error(`[mobile-config] ${variant} requires GOOGLE_MAPS_ANDROID_API_KEY`)
  }
}

module.exports = ({ config }) => {
  const variant = normalizedVariant()
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || ''
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || ''
  const easProjectId = process.env.EAS_PROJECT_ID?.trim() || ''

  validateReleaseConfiguration({ variant, apiUrl, easProjectId, androidMapsKey })

  return {
    ...config,
    ...staticConfig.expo,
    android: {
      ...staticConfig.expo.android,
      ...(androidMapsKey
        ? {
            config: {
              ...(staticConfig.expo.android?.config || {}),
              googleMaps: { apiKey: androidMapsKey },
            },
          }
        : {}),
    },
    extra: {
      ...(staticConfig.expo.extra || {}),
      releaseChannel: variant,
      ...(easProjectId
        ? {
            eas: {
              ...(staticConfig.expo.extra?.eas || {}),
              projectId: easProjectId,
            },
          }
        : {}),
      releaseCapabilities: {
        apiHttpsConfigured: Boolean(apiUrl),
        androidGoogleMapsConfigured: Boolean(androidMapsKey),
        easProjectConfigured: Boolean(easProjectId),
      },
    },
  }
}
