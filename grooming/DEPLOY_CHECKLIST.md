## Git

Before first push:

1. Create a repository on GitHub/GitLab.
2. Run:

```bash
cd "d:\Visual Studio РАБОТЫ\vk-mini-app"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

`.gitignore` already excludes:
- `node_modules`
- `build`
- `logs`
- real `.env` files

## Backend env

Use `grooming/backend/.env.example` as a template.

If you already have a working local `grooming/backend/.env`, copy it to the server and update:

```env
ALLOWED_ORIGINS=https://stage-app54468624-89ebda8c88b1.pages.vk-apps.com,https://YOUR_DOMAIN
```

At minimum, backend `.env` must contain:

```env
PORT=5000
JWT_SECRET=replace-with-strong-random-secret
ALLOWED_ORIGINS=https://stage-app54468624-89ebda8c88b1.pages.vk-apps.com,https://YOUR_DOMAIN
```

Plus your existing DB variables from the local working `.env`.

The backend code also allows VK Mini Apps Hosting origins by pattern, but after changing `.env` or backend code you still need to restart the process on the VPS:

```bash
pm2 restart grooming-backend --update-env
```

## Nginx API proxy

`https://api.groomingptz.ru` must point to the Express backend, not to static frontend files.

Use `deploy/nginx-api.conf.example` as the server block template. After installing it on the VPS, check:

```bash
curl https://api.groomingptz.ru/health
curl -i -X OPTIONS https://api.groomingptz.ru/auth/discover \
  -H "Origin: https://stage-app54468624-89ebda8c88b1.pages.vk-apps.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Expected result: `/health` returns JSON with `"ok": true`, and the `OPTIONS` response includes `access-control-allow-origin`.

## Frontend env

Local development:

```env
VITE_API_URL=http://localhost:5000
```

Production:

```env
VITE_API_URL=https://YOUR_BACKEND_DOMAIN
```

Update `grooming/.env.production` before each production build if backend URL changes.

## Backend health check

Available endpoints:

- `GET /`
- `GET /health`

Use them before frontend deploy:

```bash
curl https://YOUR_BACKEND_DOMAIN/health
```

## Frontend deploy

```bash
cd grooming
npm install
npm run build
npx vk-miniapps-deploy
```
