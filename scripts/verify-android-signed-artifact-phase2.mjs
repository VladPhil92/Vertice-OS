import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []
const requireValue = (condition, message) => { if (!condition) failures.push(message) }
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))

let request, eas, app
try {
  request = readJson('release/android/phase2-signed-artifact.json')
  eas = readJson('apps/mobile/eas.json')
  app = readJson('apps/mobile/app.json').expo
} catch (error) {
  console.error('Android signed artifact Phase 2 contract: FAIL')
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const canonical = {
  package: 'com.ctgone.verticeos',
  projectId: '4ee77781-adec-42f6-be19-64a68848f4c7',
  cli: '24.7.0'
}

requireValue(request.schema_version === 1, 'schema_version must be 1')
requireValue(request.phase === 'android-signed-artifact-and-play-testing', 'unexpected phase id')
requireValue(request.release_source === 'triggering_main_commit', 'release_source must be triggering_main_commit')
requireValue(request.platform === 'android', 'platform must be android')
requireValue(request.android_package === canonical.package, 'request android package drifted')
requireValue(request.eas_project_id === canonical.projectId, 'request EAS project id drifted')
requireValue(request.eas_cli_version === canonical.cli, 'request EAS CLI pin drifted')
requireValue(request.build_profile === 'production', 'build profile must be production')
requireValue(request.eas_environment === 'production', 'EAS environment must be production')
requireValue(request.production_config_preflight === true, 'production Expo config preflight must remain enabled')
requireValue(request.static_eas_project_link === true, 'release request must require static EAS project linkage')
requireValue(request.google_maps_variable === 'GOOGLE_MAPS_ANDROID_API_KEY', 'Google Maps variable contract drifted')
requireValue(request.google_maps_visibility_required === 'sensitive', 'Google Maps EAS visibility must remain sensitive so EAS CLI can resolve dynamic config')
requireValue(request.artifact_type === 'aab', 'artifact type must be aab')
requireValue(request.freeze_credentials === true, 'credential mutation must stay frozen during CI build')
requireValue(request.submit_after_build === true, 'Phase 2 must submit after a successful build')
requireValue(request.submit_profile === 'production', 'submit profile must be production')
requireValue(request.google_play_track === 'internal', 'Phase 2 must target internal testing only')
requireValue(request.google_play_release_status === 'completed', 'internal release must be completed for tester availability')
requireValue(Number.isInteger(request.evidence_retention_days) && request.evidence_retention_days >= 1 && request.evidence_retention_days <= 90, 'evidence retention must be 1..90 days')

requireValue(app?.android?.package === canonical.package, 'app.json Android package drifted')
requireValue(app?.extra?.eas?.projectId === canonical.projectId, 'app.json must statically link the canonical EAS project before env resolution')
requireValue(eas?.cli?.requireCommit === true, 'EAS must require a committed source')
requireValue(eas?.cli?.appVersionSource === 'remote', 'EAS version source must remain remote')
requireValue(eas?.cli?.version === '>= 24.7.0 < 25.0.0', 'EAS CLI compatibility range must remain >=24.7.0 <25.0.0')

const build = eas?.build?.production
requireValue(build?.distribution === 'store', 'production distribution must be store')
requireValue(build?.environment === 'production', 'production build must bind EAS production environment')
requireValue(build?.autoIncrement === true, 'production build must autoIncrement native build version')
requireValue(build?.android?.buildType === 'app-bundle', 'production Android build must emit app-bundle')
requireValue(build?.env?.APP_VARIANT === 'production', 'production APP_VARIANT must be production')
requireValue(build?.env?.EXPO_PUBLIC_RELEASE_CHANNEL === 'production', 'production release channel must be production')
requireValue(build?.env?.EAS_PROJECT_ID === canonical.projectId, 'production EAS project id drifted')
requireValue(/^https:\/\//.test(build?.env?.EXPO_PUBLIC_API_URL ?? ''), 'production API URL must use HTTPS')

const submit = eas?.submit?.production?.android
requireValue(submit?.track === request.google_play_track, 'EAS submit track must match request')
requireValue(submit?.releaseStatus === request.google_play_release_status, 'EAS submit releaseStatus must match request')
requireValue(!('serviceAccountKeyPath' in (submit ?? {})), 'Google service-account key path must not be committed in eas.json')

const serialized = JSON.stringify({ request, eas })
requireValue(!/AIza[0-9A-Za-z_-]{20,}/.test(serialized), 'Google API keys must not be embedded in release request/config')
requireValue(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(serialized), 'private key material is forbidden')
requireValue(!/"private_key"\s*:/.test(serialized), 'service-account private key payload is forbidden')

if (failures.length) {
  console.error('Android signed artifact Phase 2 contract: FAIL')
  for (const failure of failures) console.error('- ' + failure)
  process.exit(1)
}

console.log('Android signed artifact Phase 2 contract: PASS')
console.log('Build source: exact triggering main commit')
console.log('Artifact: signed production AAB through EAS Build')
console.log('Google Play destination: internal testing only')
console.log('Credentials remain external to Git and must already exist in GitHub/EAS/Google.')
