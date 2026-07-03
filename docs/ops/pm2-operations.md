# PM2 Operations

Production app managed by this repository:

```text
agrios-backend
```

The PM2 ecosystem file is `ecosystem.config.cjs`. It defines only `agrios-backend` and must not define, delete, or override `mahjong-backend`.

Production entry:

```text
/home/ubuntu/agrios-server/apps/backend/dist/src/main.js
```

Useful commands:

```bash
pm2 status
pm2 describe agrios-backend
pm2 startOrReload ecosystem.config.cjs --only agrios-backend --update-env
pm2 save
pm2 startup
```

Log files:

```text
/home/ubuntu/.pm2/logs/agrios-backend-out.log
/home/ubuntu/.pm2/logs/agrios-backend-error.log
```

Install log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateInterval "0 0 * * *"
pm2 set pm2-logrotate:workerInterval 30
pm2 set pm2-logrotate:rotateModule true
pm2 conf pm2-logrotate
pm2 list
```

Do not remove existing logs unless a rotated copy has been confirmed.
