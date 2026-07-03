# Database Backup And Restore

Backup scripts live under `scripts/ops` and read database settings from `apps/backend/.env`. They do not print the database URL, username, password, or full connection string.

Daily backup:

```bash
cd /home/ubuntu/agrios-server
bash scripts/ops/backup-mysql.sh
```

Default output directory:

```text
/home/ubuntu/backups/agrios/daily
```

Verify a backup:

```bash
bash scripts/ops/verify-backup.sh /home/ubuntu/backups/agrios/daily/agrios-YYYYMMDD-HHMMSS.sql.gz
```

Restore drill:

```bash
bash scripts/ops/restore-backup-test.sh /home/ubuntu/backups/agrios/daily/agrios-YYYYMMDD-HHMMSS.sql.gz
```

The restore drill imports into a random temporary database named `agrios_restore_test_*`, checks key tables, prints row counts only, and drops only the temporary database it created. It must never restore into or drop the production database.

Cleanup:

```bash
bash scripts/ops/cleanup-backups.sh --dry-run
bash scripts/ops/cleanup-backups.sh
```

Retention:

- daily backups: 7 days
- weekly backups: 4 weeks
- pre-deploy backups: latest 10
- pre-migration backups: latest 10
- Stage 2 backup is explicitly retained

Key tables checked by verification: `User`, `Tenant`, `Farm`, `TenantFarm`, `Field`, `Device`, `_prisma_migrations`.
