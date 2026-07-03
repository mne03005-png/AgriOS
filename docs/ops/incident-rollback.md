# Incident Rollback

First collect current state:

```bash
cd /home/ubuntu/agrios-server
git log -3 --oneline
git status --short --branch
pm2 status
curl -I https://agrios.xyzwtt.com/
curl -I https://agrios.xyzwtt.com/mobile/
curl -s https://agrios-api.xyzwtt.com/api/v1/health/ready
```

Rollback principles:

- Database backup failure: stop deployment.
- Backup verification failure: stop deployment.
- Migration failure: stop and inspect; do not run `migrate reset`.
- Backend build failure: do not reload PM2.
- Nginx test failure: do not reload Nginx.
- Health-check failure: report and inspect logs before another action.

Code rollback should use an intentional Git revert or a normal fast-forward deployment of a known-good commit. Do not use `git reset --hard` unless explicitly approved for a dedicated incident procedure.

Database rollback is manual and high risk. Restore only from a verified backup and only with an explicit restoration plan.
