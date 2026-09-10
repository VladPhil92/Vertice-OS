import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const forbiddenPathPatterns = [
  { re: /(^|\/)google-services\.json$/i, label: 'Firebase Android google-services.json' },
  { re: /(^|\/)GoogleService-Info\.plist$/i, label: 'Firebase iOS GoogleService-Info.plist' },
  { re: /(^|\/)[^/]*service[-_]?account[^/]*\.json$/i, label: 'service-account JSON' },
  { re: /(^|\/)credentials\.json$/i, label: 'credentials.json' },
  { re: /\.jks$/i, label: 'Android JKS keystore' },
  { re: /\.keystore$/i, label: 'Android keystore' },
  { re: /\.p8$/i, label: 'Apple/Auth private key' },
  { re: /\.p12$/i, label: 'PKCS#12 signing bundle' },
  { re: /\.mobileprovision$/i, label: 'Apple provisioning profile' },
]

const forbiddenContentPatterns = [
  { re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'private key material' },
  { re: /-----BEGIN ENCRYPTED PRIVATE KEY-----/, label: 'encrypted private key material' },
]

const allowedTextExtensions = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.yml', '.yaml', '.md', '.txt', '.env', '.example', '.gitignore', '.toml', '.sh', '.sql', '.py', '.html', '.css', '.scss', '.xml', '.plist',
])

const failures = []

for (const file of tracked) {
  for (const rule of forbiddenPathPatterns) {
    if (rule.re.test(file)) failures.push(`${file}: tracked ${rule.label} is forbidden`)
  }

  const lower = file.toLowerCase()
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : ''
  if (!allowedTextExtensions.has(ext) && !file.endsWith('.gitignore')) continue

  let content
  try {
    content = fs.readFileSync(file, 'utf8')
  } catch {
    continue
  }

  for (const rule of forbiddenContentPatterns) {
    if (rule.re.test(content)) failures.push(`${file}: contains ${rule.label}`)
  }
}

const gitignore = fs.readFileSync('.gitignore', 'utf8')
for (const requiredIgnore of [
  '*.jks',
  '*.keystore',
  '*.p8',
  '*.p12',
  '*.mobileprovision',
  '**/google-services.json',
  '**/GoogleService-Info.plist',
  '**/*service-account*.json',
  'apps/mobile/credentials.json',
]) {
  if (!gitignore.split(/\r?\n/).includes(requiredIgnore)) {
    failures.push(`.gitignore: missing signing-secret pattern ${requiredIgnore}`)
  }
}

if (failures.length) {
  console.error('Mobile signing credential boundary: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Mobile signing credential boundary: PASS')
console.log('No tracked signing/private-key/service-account artifacts matched the forbidden contract.')
console.log('This check does not prove that external EAS/Apple/Google credentials exist or are correctly configured.')
