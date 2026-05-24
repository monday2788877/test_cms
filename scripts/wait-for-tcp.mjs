import net from 'node:net'

const [host = 'localhost', port = '5432'] = process.argv.slice(2)
const timeoutMs = Number(process.env.WAIT_TIMEOUT_MS || 60000)
const started = Date.now()

function tryConnect() {
  const socket = net.createConnection(Number(port), host)
  socket.once('connect', () => {
    socket.end()
    process.exit(0)
  })
  socket.once('error', () => {
    socket.destroy()
    if (Date.now() - started > timeoutMs) {
      console.error(`Timed out waiting for ${host}:${port}`)
      process.exit(1)
    }
    setTimeout(tryConnect, 1000)
  })
}

tryConnect()
