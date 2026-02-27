# Render Deployment — Important Note

## Active Blueprint

The **active** Render blueprint is located at the **project root**:

```
/render.yaml   ← THIS IS THE ACTIVE FILE
```

It defines two services in production:

| Service name | Type | Root dir |
|---|---|---|
| `appcleanpremium-backend` | web (Node) | `backend/backend-api` |
| `appcleanpremium-frontend` | static | `frontend` |

## Stale File — DO NOT USE

```
/backend/render.yaml   ← STALE — NOT used by Render
```

This file is an **outdated draft** that still references the legacy hostname
`brightsbrokscleanproclean2026.onrender.com`. It has no effect on deployments
(Render uses the root-level blueprint), but it must **not** be promoted or
used as a replacement for the root `render.yaml`.

## Environment Variables (Render Dashboard)

Both services require the following env vars to be set manually in the
Render dashboard (`sync: false`):

**Backend (`appcleanpremium-backend`):**
- `MONGODB_URI`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `JWT_SECRET`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `PUSH_PUBLIC_KEY` / `PUSH_PRIVATE_KEY`

**Frontend (`appcleanpremium-frontend`):**
- `VITE_API_URL` = `https://appcleanpremium-backend.onrender.com`
- `VITE_PUSH_PUBLIC_KEY`

> `VITE_API_URL` **must** be set in the Render dashboard before building the
> frontend. Vite resolves `import.meta.env.*` at build time — if the variable
> is missing, the build will fail to connect to the correct backend.
