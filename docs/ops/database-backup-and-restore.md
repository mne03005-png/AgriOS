# Database Backup And Restore

## Production database target (authoritative)

The live AgriOS production database is a Docker container, not a host-level
MySQL instance:

```text
Docker compose project: agrios-gray
Container:              agrios-gray-agrios-mysql-1
Host port published:    NONE
Reachable via:          the container itself (docker exec) or the
                         agrios-gray-internal Docker network, as
                         "agrios-mysql:3306" from inside that network
```

Backups must go through the container/internal Docker network. **Never**
assume `127.0.0.1:3306` on the production host is the AgriOS database --
a separate, unrelated MySQL instance (for a different application on the
same host) publishes that exact host port. A prior incident (DEPLOY-RC-0,
2026-08-13) found the daily backup had been silently targeting that
unrelated instance for 9+ days after the 2026-08-04 Docker cutover, because
it resolved its target from `DATABASE_URL` in a stale host-checkout
`apps/backend/.env` file instead of the actual running container. This was
corrected in `scripts/ops/backup-mysql.sh` (DEPLOY-RC-0A, 2026-08-13): it
now resolves `agrios-gray-agrios-mysql-1` by exact container name via
`docker exec`/`docker inspect`, never via a host port, and fails loudly
(non-zero exit, no partial file left behind) if that container is
missing, stopped, or unhealthy -- it will not fall back to any other
database.

`scripts/ops/restore-backup-test.sh` still reads `DATABASE_URL` from
`apps/backend/.env` and has **not** been corrected as part of this fix --
treat its restore-drill output as unverified until it is updated to the
same container-based approach. `scripts/ops/verify-backup.sh` is unaffected
(it only inspects the backup file itself, no database connection).

Backup scripts live under `scripts/ops`. They do not print the database URL, username, password, or full connection string.

Daily backup:

```bash
cd /home/ubuntu/agrios-server
bash scripts/ops/backup-mysql.sh
```

Default output directory:

```text
/home/ubuntu/backups/agrios/live-docker
```

Legacy/pre-cutover backups (targeted the wrong database, kept only for forensic
reference, not usable for restoring the current production database):

```text
/home/ubuntu/backups/agrios/daily
/home/ubuntu/backups/agrios/pre-deploy
/home/ubuntu/backups/agrios/pre-stage2
/home/ubuntu/backups/agrios/pre-stage3
/home/ubuntu/backups/agrios/cutover
```

Verify a backup:

```bash
bash scripts/ops/verify-backup.sh /home/ubuntu/backups/agrios/live-docker/agrios-live-docker-YYYYMMDD-HHMMSS.sql.gz
```

Restore drill (see the correctness caveat above -- not yet updated to the
container-based target):

```bash
bash scripts/ops/restore-backup-test.sh /home/ubuntu/backups/agrios/live-docker/agrios-live-docker-YYYYMMDD-HHMMSS.sql.gz
```

The restore drill imports into a random temporary database named `agrios_restore_test_*`, checks key tables, prints row counts only, and drops only the temporary database it created. It must never restore into or drop the production database.

Cleanup:

```bash
bash scripts/ops/cleanup-backups.sh --dry-run
bash scripts/ops/cleanup-backups.sh
```

Retention:

- `live-docker` backups (current, verified-correct target): no automated retention yet -- accumulates until a retention rule is deliberately added; the dataset is small (low hundreds of MB), so this is not an immediate concern
- daily backups (legacy, wrong target, pre-2026-08-13 fix): 7 days -- `cleanup-backups.sh` still applies this to the `daily` directory unchanged
- weekly backups: 4 weeks
- pre-deploy backups: latest 10
- pre-migration backups: latest 10
- Stage 2 backup is explicitly retained

Key tables checked by verification: `User`, `Tenant`, `Farm`, `TenantFarm`, `Field`, `Device`, `_prisma_migrations`.
