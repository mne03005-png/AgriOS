import { PrismaClient } from '@prisma/client';

const url = new URL(process.env.DATABASE_URL ?? '');
if (url.protocol !== 'mysql:' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) throw new Error('MYSQL_SMOKE_REQUIRES_LOOPBACK');
const database = url.pathname.replace(/^\//, '');
if (!/^agrios_p0_migration_smoke_[a-z0-9_]+$/i.test(database)) throw new Error('MYSQL_SMOKE_REQUIRES_ISOLATED_DATABASE_NAME');

const expected = {
  DeviceCommand: ['PENDING','DISPATCHING','SENT','ACKED','FEEDBACK_PENDING','PHYSICALLY_CONFIRMED','FEEDBACK_MISMATCH','FEEDBACK_TIMEOUT','FEEDBACK_UNAVAILABLE','OUTCOME_UNKNOWN','FAILED','TIMEOUT'],
  DecisionRecord: ['PROPOSED','PLANNED','AWAITING_CONFIRMATION','EXECUTED','SKIPPED','FAILED'],
  ActionPlan: ['PLANNED','PENDING_APPROVAL','BLOCKED','EXECUTING','AWAITING_CONFIRMATION','EXECUTED','SKIPPED','FAILED'],
  ActionExecution: ['PENDING','DISPATCHING','SENT','ACKED','FEEDBACK_PENDING','PHYSICALLY_CONFIRMED','FEEDBACK_MISMATCH','FEEDBACK_TIMEOUT','FEEDBACK_UNAVAILABLE','OUTCOME_UNKNOWN','FAILED','SKIPPED'],
  ActionQueueJob: ['PENDING','QUEUED','EXECUTING','AWAITING_CONFIRMATION','SUCCESS','FAILED','RETRYING','DEAD_LETTERED']
};
const prisma = new PrismaClient();
try {
  for (const [table, values] of Object.entries(expected)) {
    const rows = await prisma.$queryRawUnsafe(`SELECT COLUMN_TYPE AS columnType FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'status'`, table);
    if (rows.length !== 1) throw new Error(`MYSQL_ENUM_COLUMN_MISSING:${table}`);
    const columnType = String(rows[0].columnType);
    for (const value of values) if (!columnType.includes(`'${value}'`)) throw new Error(`MYSQL_ENUM_VALUE_MISSING:${table}:${value}`);
    const probe = `P0EnumProbe${table}`;
    await prisma.$executeRawUnsafe(`CREATE TEMPORARY TABLE \`${probe}\` (\`value\` ${columnType} NOT NULL)`);
    for (const value of values) await prisma.$executeRawUnsafe(`INSERT INTO \`${probe}\` (\`value\`) VALUES (?)`, value);
    const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM \`${probe}\``);
    if (Number(count[0].count) !== values.length) throw new Error(`MYSQL_ENUM_PROBE_FAILED:${table}`);
  }
  console.log(`MYSQL_MIGRATION_SMOKE=PASS provider=mysql database=${database} enum_columns=${Object.keys(expected).length}`);
} finally { await prisma.$disconnect(); }
