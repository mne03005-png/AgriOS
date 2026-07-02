# AgriOS P11.7.2 Demo Acceptance And Showcase

## 1. Configure Database

Create `apps/backend/.env`:

```text
DATABASE_URL="mysql://agrios:your_password@localhost:3306/agrios"
```

Create MySQL database and user if needed:

```sql
CREATE DATABASE agrios DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'agrios'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON agrios.* TO 'agrios'@'localhost';
FLUSH PRIVILEGES;
```

Do not commit real passwords.

## 2. Run Migration

```bash
cd apps/backend
npx prisma validate --schema prisma/schema.prisma
npx prisma migrate dev --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
```

## 3. Run Seed

```bash
cd apps/backend
npx prisma db seed
```

This initializes the demo farm:

```text
farmId=demo
```

## 4. Start Backend

```bash
cd apps/backend
npm run start:dev
```

## 5. Start Mobile

Start the mobile app using the project mobile dev command. The mobile default farm id is `demo`.

## 6. Check Demo Health

```bash
curl http://localhost:3000/api/v1/demo/health?farmId=demo
```

Ready response should include:

- `isReady: true`
- `missingItems: []`
- module statuses marked ready
- `mobileCockpitReady: true`

PowerShell acceptance script:

```powershell
apps/backend/scripts/p11_7_2_demo_acceptance.ps1
```

## 7. Showcase Order

1. Cockpit
   - farm status
   - risk cards
   - pressure and flow
   - water-fertilizer status
   - farm activity timeline

2. Map
   - field boundary
   - drone route
   - drone coverage layer
   - sensors, valves and pumps

3. Operations
   - rotation runs
   - fertigation tasks
   - drone operation groups

4. Drone Operations
   - upload panel
   - demo operation records
   - coverage summary

5. Drone Reviews
   - review list
   - approve/reject/link-field workflow

6. Reports
   - operation costs
   - pesticide usage
   - drone service cost
   - crop health observations
   - yield factors

7. Field Detail
   - field detail summary
   - drone records
   - crop health
   - operation reports

8. Demo Status
   - readiness
   - module status
   - missing items
   - recommended actions

## 8. Common Issues

### DATABASE_URL Error

Make sure `apps/backend/.env` exists and contains a valid MySQL URL.

### MySQL Permission Error

Run:

```sql
GRANT ALL PRIVILEGES ON agrios.* TO 'agrios'@'localhost';
FLUSH PRIVILEGES;
```

### migration_lock.toml Missing

The historical migration folder may not include a lock file. Do not delete migrations. Use:

```bash
npx prisma migrate status --schema prisma/schema.prisma
```

### Seed Repeated Execution

The demo seed uses fixed demo IDs and `upsert`. Re-running it should update the baseline instead of duplicating demo rows.

### Mobile Empty Data

If mobile pages show empty-state prompts:

1. run `npx prisma db seed`
2. restart backend
3. visit `/demo-status`
4. call `/api/v1/demo/health?farmId=demo`

## Safety

P11.7.2 does not:

- change ThingsBoard/Webhook
- automatically open pumps or valves
- control drones
- run `npm audit fix`
- install eslint
