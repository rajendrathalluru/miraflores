# Deploy Miraflores

The same Node.js application runs on a Linux container host, a VPS, or a managed Next.js platform. Supabase stores review state and evidence; containers need no data volume when `DATABASE_URL` is set. This is a protected assignment demo, with simulated personas, not production client authentication.

## Environment variables

Set secrets in the platform's secret manager, never in Git or image build arguments:

- `DATABASE_URL`: Supabase session-pooler URI, including the URL-encoded password and `?sslmode=require`.
- `WORKPAPER_ACCESS_PASSWORD`: a strong shared password for the demo. Browsers prompt for this before opening the workspace.
- `WORKPAPER_ACCESS_USER`: optional; defaults to `reviewer`.
- `PORT`: optional; container default is `3000`. `HOSTNAME` defaults to `0.0.0.0` in the image.

Use HTTPS on the hosting platform or reverse proxy. Basic authentication protects demo access; it does not identify individual staff. Every authorized demo viewer can switch fictional personas. Do not put real taxpayer data in this demo. Keep the database schema private and restrict credentials; use genuine identity, membership checks and database permissions before real client use.

The remote adapter creates a private `miraflores` schema and its tables on startup. The supplied connection currently has schema creation rights. Provision the schema before changing to a restricted runtime database role. New containers reuse existing engagements. Startup imports the seed only when the engagement table is empty. Switching from local PGlite does not migrate existing local reviews.

## Docker: any Linux container platform

```sh
docker build -t miraflores-workpaper:latest .
# deployment.env is an ignored local file containing the variables above.
docker run --rm --name miraflores --init --env-file deployment.env \
  -p 127.0.0.1:3000:3000 miraflores-workpaper:latest
```

Put the service behind an HTTPS reverse proxy on a VPS. Managed container platforms should route their public HTTPS endpoint to the container's `PORT`; do not override its bind hostname to loopback. Docker Compose binds to loopback intentionally for a local preview or reverse proxy:

```sh
docker compose --env-file deployment.env up --build -d
docker compose logs -f
docker compose down
```

For Render, Railway, Fly.io, AWS ECS, Google Cloud Run, Azure Container Apps or another OCI host: select the repository Dockerfile (or publish this image to your registry), set the secrets, configure container port `3000` or the platform-provided `PORT`, and use `/api/health` as the health-check path. Configure the platform's memory, request timeout and request body limit for packet/evidence uploads. No PostgreSQL container is needed when using Supabase.

The image uses a multi-stage build, bundled fonts/static assets, a non-root runtime and a liveness check. `.dockerignore` excludes credentials and local database files. `/api/health` confirms that the HTTP process is alive; it deliberately does not expose or test database contents. Verify the signed-in workspace after deployment to check database readiness.

## Vercel: native Next.js deployment

Import the GitHub repository, select Next.js and keep the repository root as the project root. Set `DATABASE_URL`, `WORKPAPER_ACCESS_PASSWORD` and optionally `WORKPAPER_ACCESS_USER` in project environment settings. Deploy using the native Next.js integration; this does not require building the Docker image. `vercel.json` selects Next.js and allows API functions up to 60 seconds (subject to your plan).

Use a pooler connection, not embedded PGlite, on serverless platforms. Each server instance has its own connection pool; account for instance count in database connection limits. Vercel Functions have a [4.5 MB request/response limit](https://vercel.com/docs/errors/function_payload_too_large), below this app's 8 MB evidence and 12 MB packet limits. Larger uploads require direct private object-storage uploads or a container host with a suitable body limit; a function timeout setting does not raise the body limit. Do not describe those larger uploads as supported on Vercel without testing the target platform.

## Verify a deployment

1. `/api/health` returns `{"status":"ok"}`.
2. A fresh browser prompts for demo credentials; incorrect credentials fail.
3. Correct credentials open the workspace and load the assignment packet.
4. Save a review action, restart/redeploy the application and confirm it persists.
5. Verify source navigation, role projections and a small evidence upload/download.

Use a separate Supabase project/database for preview deployments if they must not share production demo reviews. Do not run `tests/api.mjs` against the shared demo database: it intentionally mutates its target.

## Verification performed

Production standalone build and all 12 tests passed. The standalone server returned 200 for health, 401 for unauthenticated page/API access, and 200 for authenticated page/workspace access using a disposable local database. Compose configuration validation passed. The Docker daemon was unavailable on the development machine, so the actual Linux image build and container startup remain to be tested with Docker Desktop running. No deployment has been published.
