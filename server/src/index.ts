import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { SessionHandler } from './ws/SessionHandler.js'

const PORT = Number(process.env.PORT ?? 3001)

const httpServer = createServer((_req, res) => {
  res.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET',
  })
  res.end(JSON.stringify({ ok: true, service: 'astrds-game-server' }))
})

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (socket) => {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const handler = new SessionHandler(socket, sessionId)
  handler.start()

  socket.on('message', (data) => {
    handler.handle(data.toString())
  })

  socket.on('close', () => {
    handler.stop()
  })

  socket.on('error', (error) => {
    console.error('WebSocket session error:', error)
    handler.stop()
  })
})

httpServer.listen(PORT, () => {
  console.log(`ASTRDS game server listening on ws://localhost:${PORT}`)
})
