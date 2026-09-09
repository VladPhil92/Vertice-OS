import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function requireContract(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(`[production-hardening] ${message}`)
  }
}

const app = read('apps/api/src/app.ts')
const runtimePolicy = read('apps/api/src/lib/runtime-readiness.ts')
const entrypoint = read('apps/api/src/index.ts')
const healthTests = read('apps/api/src/__tests__/health.test.ts')
const runtimeTests = read('apps/api/src/__tests__/runtime-readiness.test.ts')
const k8sDeployment = read('infrastructure/kubernetes/api/deployment.yaml')

requireContract(app, /app\.get\('\/health\/live'/, 'missing dependency-free liveness endpoint')
requireContract(app, /app\.get\('\/health\/ready'/, 'missing serving readiness endpoint')
requireContract(app, /app\.get\('\/health\/release'/, 'missing strict release readiness endpoint')
requireContract(app, /assessment\.servingReady \? 200 : 503/, 'serving readiness is not fail-closed')
requireContract(app, /assessment\.releaseReady \? 200 : 503/, 'release readiness is not fail-closed')

requireContract(runtimePolicy, /'redis',[\s\n]*'database'/, 'Redis and database must remain core dependencies')
requireContract(runtimePolicy, /OPTIONAL_DEPENDENCIES[\s\S]*'neo4j'/, 'Neo4j optional dependency policy is missing')
requireContract(runtimePolicy, /state === 'misconfigured'/, 'misconfigured capabilities must be detected')
requireContract(runtimePolicy, /runtime:revision_unknown/, 'production release must require an immutable revision')

requireContract(entrypoint, /SHUTDOWN_TIMEOUT_MS = 15_000/, 'bounded shutdown deadline is missing')
requireContract(entrypoint, /let shuttingDown = false/, 'shutdown idempotency guard is missing')
requireContract(entrypoint, /process\.once\('SIGTERM'/, 'SIGTERM must use a one-shot handler')
requireContract(entrypoint, /process\.once\('SIGINT'/, 'SIGINT must use a one-shot handler')
requireContract(entrypoint, /fatal:unhandledRejection/, 'unhandled rejections must be fatal')
requireContract(entrypoint, /fatal:uncaughtException/, 'uncaught exceptions must be fatal')

requireContract(healthTests, /GET \/health\/live/, 'liveness regression coverage is missing')
requireContract(healthTests, /GET \/health\/release/, 'release health regression coverage is missing')
requireContract(runtimeTests, /capability:crowdfunding_payments/, 'capability blocker regression coverage is missing')
requireContract(runtimeTests, /runtime:revision_unknown/, 'revision blocker regression coverage is missing')

requireContract(k8sDeployment, /terminationGracePeriodSeconds: 30/, 'Kubernetes termination grace period must exceed runtime shutdown deadline')
requireContract(k8sDeployment, /path: \/health\/live/, 'Kubernetes liveness probe must not use dependency readiness')
requireContract(k8sDeployment, /path: \/health\/ready/, 'Kubernetes readiness probe must use serving readiness')

console.log('[production-hardening] contract verified')
