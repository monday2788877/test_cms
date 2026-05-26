import { spawn } from 'node:child_process'

const port = process.env.PORT || '3000'
const fatalPatterns = [
  /idle-in-transaction timeout/i,
  /terminating connection due to/i,
  /connection terminated unexpectedly/i,
  /remaining connection slots are reserved/i,
  /too many clients/i,
  /relation "app_configs" does not exist/i,
]

let exiting = false

function shouldRestart(chunk) {
  return fatalPatterns.some((pattern) => pattern.test(chunk))
}

function killAndExit(child, reason) {
  if (exiting) return
  exiting = true
  console.error(`[cms-supervisor] Fatal CMS runtime error detected. Exiting so Railway can restart. Reason: ${reason}`)
  try {
    child.kill('SIGTERM')
  } catch {}
  setTimeout(() => process.exit(1), 1500).unref()
}

const child = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-H', '0.0.0.0', '-p', port], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
})

child.stdout.on('data', (data) => {
  const text = data.toString()
  process.stdout.write(text)
  if (shouldRestart(text)) killAndExit(child, text.slice(0, 300))
})

child.stderr.on('data', (data) => {
  const text = data.toString()
  process.stderr.write(text)
  if (shouldRestart(text)) killAndExit(child, text.slice(0, 300))
})

child.on('exit', (code, signal) => {
  if (exiting) return
  if (signal) {
    console.error(`[cms-supervisor] Next exited with signal ${signal}`)
    process.exit(1)
  }
  process.exit(code ?? 0)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    try {
      child.kill(signal)
    } finally {
      setTimeout(() => process.exit(0), 1000).unref()
    }
  })
}
