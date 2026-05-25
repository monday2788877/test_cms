# Cloudflare R2 setup for Payload CMS Railway

Set these Railway variables on the Payload CMS service:

```env
R2_ENABLED=true
R2_ACCOUNT_ID=<CLOUDFLARE_ACCOUNT_ID>
R2_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
R2_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
R2_BUCKET=real-estate-media
R2_REGION=auto
R2_ENDPOINT=https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://media-uat-agreement.tpbs.com.vn
```

Important:

- `R2_ENDPOINT` is the S3 API endpoint used for upload.
- `R2_PUBLIC_URL` is the public URL/custom domain used to serve media.
- Do not put `/api`, `/admin`, or bucket path at the end of `R2_ENDPOINT`.
- After changing R2 variables, redeploy the Railway service.

This source runs `payload generate:importmap` before `next build`, and `src/app/(payload)/admin/importMap.js` also includes a static fallback for `@payloadcms/storage-s3/client#S3ClientUploadHandler`.
