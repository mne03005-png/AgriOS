# AgriOS Production Deploy Script

Run from the production repository:

```bash
cd /home/ubuntu/agrios-server
./scripts/deploy/deploy-production.sh --dry-run
./scripts/deploy/deploy-production.sh
```

The script manages only `agrios-backend`. It does not define or modify `mahjong-backend`.

Options:

- `--dry-run`: performs preflight checks and prints the planned write steps without pulling, backing up, migrating, publishing, or reloading services.
- `--skip-mobile`: skips mobile verification, build, and rsync.
- `--skip-backup`: high-risk mode. A live deployment requires manual confirmation before continuing.

The script stops on backup failure, migration failure, build failure, `nginx -t` failure, or health-check failure. It does not force pull, reset the repository, change `.env`, modify device-control safety switches, or perform database rollback.
