const preset = require('jest-expo/jest-preset')

// lucide-react-native's package.json "exports" map serves its ESM build
// (.mjs) under the "react-native" condition, which jest-expo's Metro-alike
// resolver honors. The preset's own transform only matches .[jt]sx?$, so
// those .mjs files reach Jest untransformed and fail on bare `export`
// syntax. Reuse the exact same babel-jest transform entry for .mjs, and add
// lucide-react-native to the node_modules transform allowlist so it isn't
// skipped as third-party code.
module.exports = {
  ...preset,
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/'],
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|lucide-react-native))',
  ],
  transform: {
    ...preset.transform,
    '\\.mjs$': preset.transform['\\.[jt]sx?$'],
  },
}
