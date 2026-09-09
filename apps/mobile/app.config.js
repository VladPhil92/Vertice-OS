module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim()
  const easProjectId = process.env.EAS_PROJECT_ID?.trim()

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      eas: {
        ...(config.extra?.eas ?? {}),
        ...(easProjectId ? { projectId: easProjectId } : {}),
      },
    },
    android: {
      ...(config.android ?? {}),
      ...(googleMapsApiKey
        ? {
            config: {
              ...(config.android?.config ?? {}),
              googleMaps: { apiKey: googleMapsApiKey },
            },
          }
        : {}),
    },
  }
}
