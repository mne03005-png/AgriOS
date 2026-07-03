# Monitoring And Health Check

Manual health check:

```bash
cd /home/ubuntu/agrios-server
bash scripts/ops/health-check.sh
```

Log path:

```text
/home/ubuntu/agrios-ops/logs/health-check.log
```

Checks include:

- live and ready HTTP status
- PM2 `agrios-backend` status
- disk and inode usage
- memory usage
- restart count
- latest backup age and verification
- current deployment commit
- desktop and mobile HTTP status

Install local cron jobs idempotently:

```bash
cd /home/ubuntu/agrios-server
bash scripts/ops/install-cron.sh
```

The installer preserves existing crontab entries and replaces only the marked AgriOS block.

Default schedule:

- daily database backup: 02:30
- backup cleanup: 03:30
- health check: every 5 minutes
- restore drills: manual only

No external SMS, email, or webhook notification is enabled by default.
