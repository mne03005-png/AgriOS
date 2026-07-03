# Production Deployment

Production host:

- SSH: `ssh -i "<local-key>" -o BatchMode=yes -p 22022 ubuntu@100.64.5.29`
- Repository: `/home/ubuntu/agrios-server`
- API: `https://agrios-api.xyzwtt.com/api/v1`
- Desktop site: `https://agrios.xyzwtt.com/`
- Mobile site: `https://agrios.xyzwtt.com/mobile/`
- Mobile publish directory: `/www/wwwroot/agrios.xyzwtt.com/mobile`
- Nginx config: `/www/server/panel/vhost/nginx/agrios.xyzwtt.com.conf`
- PM2 app: `agrios-backend`

Safe deploy flow:

```bash
cd /home/ubuntu/agrios-server
./scripts/deploy/deploy-production.sh --dry-run
./scripts/deploy/deploy-production.sh
```

The deployment script creates a database backup before a live deployment, pulls only by fast-forward, runs Prisma validation and migration deploy, builds the backend, verifies and builds mobile, publishes only the mobile directory, tests Nginx, reloads Nginx, and reloads only `agrios-backend`.

Do not use `git reset --hard`, force push, `prisma migrate reset`, `prisma db push`, or full seed in production.
