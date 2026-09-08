const staticConfig = require('./app.json')

module.exports = ({ config }) => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim()
  const easProjectId = process.env.EAS_PROJECT_ID?.trim()

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
      ...(easProjectId
        ? {
            eas: {
              ...(staticConfig.expo.extra?.eas || {}),
              projectId: easProjectId,
            },
          }
        : {}),
      releaseCapabilities: {
        androidGoogleMapsConfigured: Boolean(androidMapsKey),
        easProjectConfigured: Boolean(easProjectId),
      },
    },
  }
}
