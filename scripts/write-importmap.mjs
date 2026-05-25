import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const target = resolve(process.cwd(), 'src/app/(payload)/admin/importMap.js')
mkdirSync(dirname(target), { recursive: true })

const content = `import { S3ClientUploadHandler as S3ClientUploadHandler_0 } from '@payloadcms/storage-s3/client'\n\nexport const importMap = {\n  '@payloadcms/storage-s3/client#S3ClientUploadHandler': S3ClientUploadHandler_0,\n}\n`

writeFileSync(target, content)
console.log(`Static Payload importMap written to ${target}`)
