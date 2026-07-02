# AgriOS P11.7.1 Database Seed Verification

## What Was Checked

Files checked:

- `apps/backend/.env`: currently missing in this workspace
- `apps/backend/.env.example`: contains example `DATABASE_URL`
- `.env`: currently missing in this workspace
- `apps/backend/package.json`: Prisma seed is `ts-node prisma/seed.ts`
- `apps/backend/prisma/schema.prisma`: datasource uses `env("DATABASE_URL")`

Prisma datasource:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

## Which Env File Prisma Uses

Recommended working directory:

```bash
cd apps/backend
```

When running Prisma from `apps/backend`, put database settings in:

```text
apps/backend/.env
```

`apps/backend/.env.example` is only an example. It is not a private local configuration file until copied to `.env`.

Root `.env` can also be used by some tooling, but for this project the safest convention is:

```text
apps/backend/.env
```

Do not commit real passwords.

## DATABASE_URL Examples

Dedicated AgriOS user:

```text
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
```

Root user example:

```text
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
```

The previous local failure:

```text
Authentication failed ... credentials for agrios are not valid
```

means MySQL rejected the username/password in `DATABASE_URL`. It is not a schema or seed-code error.

## Create MySQL Database And User

Log in as a MySQL admin user:

```bash
mysql -u root -p
```

Then run:

```sql
CREATE DATABASE agrios DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'agrios'@'localhost' IDENTIFIED BY 'your_password';

GRANT ALL PRIVILEGES ON agrios.* TO 'agrios'@'localhost';

FLUSH PRIVILEGES;
```

Then create:

```text
apps/backend/.env
```

with:

```text
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
```

If using Docker from `infra/docker/docker-compose.yml`, the example credentials are:

```text
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
```

Only use that if your local Docker MySQL is the active database.

## Run Migrations

```bash
cd apps/backend
npx prisma validate --schema prisma/schema.prisma
npx prisma migrate dev --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
```

If migrations are already applied:

```bash
npx prisma migrate status --schema prisma/schema.prisma
```

## Run Seed

Run the normal project seed:

```bash
cd apps/backend
npx prisma db seed
```

This calls:

```text
ts-node prisma/seed.ts
```

`seed.ts` now also calls:

```text
prisma/seed-demo-farm.ts
```

To run only the demo farm seed:

```bash
cd apps/backend
npx ts-node prisma/seed-demo-farm.ts
```

## Verification Script

PowerShell helper:

```powershell
apps/backend/scripts/p11_7_verify_demo_seed.ps1
```

It checks:

1. `DATABASE_URL`
2. `prisma validate`
3. `prisma migrate status`
4. `prisma db seed`
5. Prints API verification commands

Run:

```powershell
cd D:\projects\AgriOS
.\apps\backend\scripts\p11_7_verify_demo_seed.ps1
```

## Verify Demo Farm

Start backend:

```bash
cd apps/backend
npm run start:dev
```

Then call:

```bash
curl http://localhost:3000/api/v1/demo/health?farmId=demo
curl http://localhost:3000/api/v1/mobile/cockpit?farmId=demo
curl http://localhost:3000/api/v1/mobile/map?farmId=demo
curl http://localhost:3000/api/v1/mobile/reports/summary?farmId=demo
curl http://localhost:3000/api/v1/farm-activities?farmId=demo
curl http://localhost:3000/api/v1/drone-operations?farmId=demo
curl http://localhost:3000/api/v1/operation-reports?farmId=demo
```

Expected `demo/health` fields:

- `tenantExists: true`
- `farmExists: true`
- `fieldsCount > 0`
- `devicesCount > 0`
- `sensorRecordsCount > 0`
- `telemetrySnapshotsCount > 0`
- `irrigationDesignsCount > 0`
- `rotationGroupsCount > 0`
- `fertigationTasksCount > 0`
- `droneOperationsCount > 0`
- `operationReportsCount > 0`
- `operationCostsCount > 0`
- `cropHealthObservationsCount > 0`
- `yieldFactorsCount > 0`
- `farmActivitiesCount > 0`
- `mobileCockpitReady: true`

## Common Errors

### Authentication failed

The username or password in `DATABASE_URL` is wrong, or the user was not granted access.

Fix:

- verify `apps/backend/.env`
- verify the MySQL user password
- run `GRANT ALL PRIVILEGES ON agrios.* TO 'agrios'@'localhost';`

### Unknown database

The database does not exist.

Fix:

```sql
CREATE DATABASE agrios DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### migration_lock.toml missing

The current historical migration folder was created before a complete Prisma lock file was present. Use `prisma migrate status` from `apps/backend`; do not delete existing migrations.

### Prisma schema engine empty error

This can happen when the local database connection is inconsistent or the migration history is incomplete. First verify `DATABASE_URL`, then run:

```bash
npx prisma validate --schema prisma/schema.prisma
npx prisma migrate status --schema prisma/schema.prisma
```

Do not treat an empty schema engine message as a model definition error unless `prisma validate` also fails.

## Safety

P11.7.1 does not:

- change ThingsBoard/Webhook ingestion
- automatically open pumps or valves
- control drones
- run `npm audit fix`
- install eslint
