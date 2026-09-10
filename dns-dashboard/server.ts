import { serveStatic } from 'hono/bun'
import { Hono } from 'hono'
import dgram from 'dgram'

const app = new Hono()

// Proxy endpoint for DNS requests
app.post('/api/send-dns', async (c) => {
  try {
    const body = await c.req.json()
    const { hexPacket, targetIp, targetPort } = body

    if (!hexPacket || !targetIp || !targetPort) {
      return c.json({ error: 'Missing parameters' }, 400)
    }

    const packetBuffer = Buffer.from(hexPacket, 'hex')

    return await new Promise((resolve) => {
      const client = dgram.createSocket('udp4')

      const timeout = setTimeout(() => {
        client.close()
        resolve(c.json({ error: 'DNS Query timeout' }, 504))
      }, 5000)

      client.on('message', (msg) => {
        clearTimeout(timeout)
        client.close()
        resolve(c.json({ responseHex: msg.toString('hex') }))
      })

      client.on('error', (err) => {
        clearTimeout(timeout)
        client.close()
        resolve(c.json({ error: err.message }, 500))
      })

      client.send(packetBuffer, targetPort, targetIp, (err) => {
        if (err) {
          clearTimeout(timeout)
          client.close()
          resolve(c.json({ error: err.message }, 500))
        }
      })
    })

  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Serve the compiled React UI and static assets
app.use('/*', serveStatic({ root: './public' }))

export default {
  port: 8000,
  fetch: app.fetch,
}
