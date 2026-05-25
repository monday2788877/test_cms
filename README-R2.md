# Cloudflare R2 setup + seed example media

## Railway Variables

Set these variables in the Payload CMS Railway service:

```env
R2_ENABLED=true
R2_ACCOUNT_ID=<CLOUDFLARE_ACCOUNT_ID>
R2_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
R2_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
R2_BUCKET=real-estate-media
R2_REGION=auto
R2_ENDPOINT=https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://media-your-domain.example.com
R2_REUPLOAD_EXISTING=true
```

`R2_ENDPOINT` is for S3 API upload. `R2_PUBLIC_URL` is for public read URLs, usually a Cloudflare R2 custom domain or temporary `r2.dev` URL.

## Push example media to R2

After Railway deploy and after the database is ready, run:

```bash
yarn seed:r2
```

The script will:

1. Upload `seed-assets/r2-demo-1.svg`, `r2-demo-2.svg`, `r2-demo-3.svg`, and `r2-demo-tour.mp4` through Payload Media.
2. Payload storage-s3 plugin will store the files in Cloudflare R2 when `R2_ENABLED=true`.
3. Create/update a demo property with slug:

```txt
r2-demo-property-media-upload-bang-cloudflare-r2
```

4. Print the uploaded media URLs.

## Run full demo seed

```bash
yarn seed:all
```

This runs normal seed first, then R2 media seed.

## Verify

Open Payload Admin:

```txt
/admin/collections/media
/admin/collections/properties
```

Open one of the R2 demo media items. The file URL should use `R2_PUBLIC_URL`.
