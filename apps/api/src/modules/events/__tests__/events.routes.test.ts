// Mock variables — 'mock' prefix allows reference inside jest.mock factories
const mockSubscribe   = jest.fn().mockResolvedValue(undefined)
const mockSubOn       = jest.fn()
const mockUnsubscribe = jest.fn().mockResolvedValue(undefined)
const mockQuit        = jest.fn().mockResolvedValue(undefined)
const mockDuplicate   = jest.fn().mockReturnValue({
  subscribe:   mockSubscribe,
  on:          mockSubOn,
  unsubscribe: mockUnsubscribe,
  quit:        mockQuit,
})

jest.mock('../../../lib/redis', () => ({
  redis: {
    ping:      jest.fn().mockResolvedValue('PONG'),
    get:       jest.fn().mockResolvedValue(null),
    set:       jest.fn().mockResolvedValue('OK'),
    del:       jest.fn().mockResolvedValue(1),
    on:        jest.fn(),
    duplicate: mockDuplicate,
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn().mockResolvedValue([]) },
}))

import * as http from 'http'
import type { AddressInfo } from 'net'
import { buildApp } from '../../../app'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let port: number

// ── SSE test helper ───────────────────────────────────────────────────────────
// Opens a real HTTP connection to the SSE endpoint, collects the initial
// 'connected' event, then destroys the connection. Returns headers and body.

function sseGet(
  path: string,
  timeoutMs = 3_000,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`SSE timeout after ${timeoutMs}ms: ${path}`)),
      timeoutMs,
    )

    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let body = ''

      res.on('data', (chunk: Buffer) => {
        body += chunk.toString()
        if (body.includes('event: connected')) {
          res.destroy()
        }
      })

      const finish = () => {
        clearTimeout(timer)
        // Small wait so server-side cleanup (unsubscribe/quit) completes
        setTimeout(() => {
          resolve({
            status:  res.statusCode!,
            headers: res.headers as Record<string, string>,
            body,
          })
        }, 60)
      }

      res.on('close', finish)
      res.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err)
        else finish()
      })
    }).on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  app = buildApp()
  await app.listen({ port: 0, host: '127.0.0.1' })
  port = (app.server.address() as AddressInfo).port
})

afterAll(async () => { await app.close() })
beforeEach(() => jest.clearAllMocks())

// ── GET /events ───────────────────────────────────────────────────────────────

describe('GET /events', () => {
  it('returns HTTP 200', async () => {
    const { status } = await sseGet('/events')
    expect(status).toBe(200)
  })

  it('sets Content-Type to text/event-stream', async () => {
    const { headers } = await sseGet('/events')
    expect(headers['content-type']).toMatch(/text\/event-stream/)
  })

  it('disables caching', async () => {
    const { headers } = await sseGet('/events')
    expect(headers['cache-control']).toBe('no-cache, no-transform')
  })

  it('sends the initial connected SSE event', async () => {
    const { body } = await sseGet('/events')
    expect(body).toContain('event: connected')
    expect(body).toContain('data:')
  })

  it('connected event payload lists the subscribed channels', async () => {
    const { body } = await sseGet('/events?channels=territorial,governance')
    const dataLine = body.split('\n').find(l => l.startsWith('data:'))!
    const data = JSON.parse(dataLine.slice('data:'.length).trim()) as { channels: string[] }
    expect(data.channels).toEqual(expect.arrayContaining(['territorial', 'governance']))
  })

  it('calls redis.duplicate() once per connection', async () => {
    await sseGet('/events')
    expect(mockDuplicate).toHaveBeenCalledTimes(1)
  })

  it('subscribes to vertice:-prefixed Redis channels', async () => {
    await sseGet('/events?channels=territorial')
    expect(mockSubscribe).toHaveBeenCalledWith('vertice:territorial')
  })

  it('subscribes to both channels when two are requested', async () => {
    await sseGet('/events?channels=territorial,governance')
    expect(mockSubscribe).toHaveBeenCalledWith('vertice:territorial', 'vertice:governance')
  })

  it('defaults to territorial,governance when no channels param is given', async () => {
    await sseGet('/events')
    expect(mockSubscribe).toHaveBeenCalledWith('vertice:territorial', 'vertice:governance')
  })

  it('accepts the system channel alone', async () => {
    await sseGet('/events?channels=system')
    expect(mockSubscribe).toHaveBeenCalledWith('vertice:system')
  })

  it('filters out channel names that are not in the allowed list', async () => {
    await sseGet('/events?channels=invalid,territorial,hack')
    expect(mockSubscribe).toHaveBeenCalledWith('vertice:territorial')
  })

  it('falls back to defaults when all requested channels are invalid', async () => {
    await sseGet('/events?channels=badchan,anotherbad')
    expect(mockSubscribe).toHaveBeenCalledWith('vertice:territorial', 'vertice:governance')
  })

  it('registers a message listener on the subscriber', async () => {
    await sseGet('/events')
    expect(mockSubOn).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('calls unsubscribe and quit when the client disconnects', async () => {
    await sseGet('/events?channels=territorial')
    expect(mockUnsubscribe).toHaveBeenCalledWith('vertice:territorial')
    expect(mockQuit).toHaveBeenCalledTimes(1)
  })
})
