import net from 'node:net'

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.DATABASE_URI || ''
}

function parseDatabaseTarget() {
  const raw = getDatabaseUrl()
  if (!raw) {
    console.error('DATABASE_URI or DATABASE_URL is required')
    process.exit(1)
  }
  try {
    const url = new URL(raw)
    return {
      // Always derive the default wait target from the actual connection string.
      // This prevents stale POSTGRES_HOST=localhost/postgres values from breaking Neon deployments.
      // Use DB_WAIT_HOST/DB_WAIT_PORT only if you intentionally need to override the wait target.
      host: process.env.DB_WAIT_HOST || url.hostname,
      port: Number(process.env.DB_WAIT_PORT || url.port || 5432),
    }
  } catch (error) {
    console.error(`Invalid database connection string: ${raw}`)
    console.error(error)
    process.exit(1)
  }
}

const { host, port } = parseDatabaseTarget()
const timeoutMs = Number(process.env.WAIT_TIMEOUT_MS || 120000)
const started = Date.now()

function tryConnect() {
  const socket = net.createConnection(port, host)
  socket.once('connect', () => {
    console.log(`Database TCP is reachable at ${host}:${port}`)
    socket.end()
    process.exit(0)
  })
  socket.once('error', (error) => {
    socket.destroy()
    if (Date.now() - started > timeoutMs) {
      console.error(`Timed out waiting for database at ${host}:${port}`)
      console.error(error)
      process.exit(1)
    }
    setTimeout(tryConnect, 1000)
  })
}

tryConnect()
