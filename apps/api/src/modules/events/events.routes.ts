import type { FastifyInstance } from 'fastify'
import { redis } from '../../lib/redis'
import { config } from '../../config'

// Channels a los que el cliente puede suscribirse
const ALLOWED_CHANNELS = ['territorial', 'governance', 'system'] as const
type AllowedChannel = typeof ALLOWED_CHANNELS[number]

export async function eventsRoutes(app: FastifyInstance): Promise<void> {

  // GET /events?channels=territorial,governance
  // Server-Sent Events — flujo unidireccional servidor → cliente
  // No requiere autenticación (eventos son datos públicos de conteos/estado)
  app.get('/events', async (request, reply) => {
    const query = request.query as { channels?: string }
    const requested = (query.channels ?? 'territorial,governance')
      .split(',')
      .map(c => c.trim())
      .filter((c): c is AllowedChannel => ALLOWED_CHANNELS.includes(c as AllowedChannel))

    const channels = requested.length > 0 ? requested : (['territorial', 'governance'] as AllowedChannel[])
    const redisChannels = channels.map(c => `vertice:${c}`)

    // Configurar cabeceras SSE antes de tomar el control del socket
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type':                'text/event-stream; charset=utf-8',
      'Cache-Control':               'no-cache, no-transform',
      Connection:                    'keep-alive',
      'X-Accel-Buffering':           'no',            // desactiva buffer en nginx
      'Access-Control-Allow-Origin': config.CORS_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
    })

    // Mensaje de conexión inicial
    res.write(`event: connected\ndata: ${JSON.stringify({ channels })}\n\n`)

    // Suscribirse a Redis — cada instancia tiene su propio subscriber
    const sub = redis.duplicate()
    await sub.subscribe(...redisChannels)

    sub.on('message', (_ch: string, message: string) => {
      try {
        res.write(`data: ${message}\n\n`)
      } catch {
        // Cliente desconectado — ignorar error de escritura
      }
    })

    // Heartbeat cada 25 s para mantener la conexión viva a través de proxies
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n')
      } catch {
        clearInterval(heartbeat)
      }
    }, 25_000)

    // Cleanup al desconectar el cliente
    request.raw.on('close', () => {
      clearInterval(heartbeat)
      sub.unsubscribe(...redisChannels).catch(() => null)
      sub.quit().catch(() => null)
    })

    // Fastify no debe cerrar la respuesta — la manejamos manualmente
    await new Promise<void>(resolve => request.raw.on('close', resolve))
  })
}
