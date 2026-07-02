# AgriOS P12 Docker Compose Deployment

P12 提供 `docker-compose.p12.yml` 作为本地演示和生产化验证底座。

## 启动 MySQL / Redis / Backend

```powershell
docker compose -f docker-compose.p12.yml up -d mysql redis
docker compose -f docker-compose.p12.yml up -d backend
```

默认端口：

- Backend: `http://localhost:3000/api/v1`
- MySQL: `localhost:3306`
- Redis: `localhost:6379`

## 配置 .env

复制 `apps/backend/.env.example` 到 `apps/backend/.env`，按本机数据库填写：

```env
DATABASE_URL="mysql://agrios:your_password@localhost:3306/agrios"
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
ENABLE_AUTO_EXECUTION=false
DEVICE_CONTROL_MODE=MOCK
```

不要把真实密码提交到仓库。

## Migrate

```powershell
cd apps/backend
npx prisma migrate dev
npx prisma generate
```

## Seed Demo

```powershell
cd apps/backend
npx prisma db seed
```

Demo 登录账号：

- email: `demo@agrios.local`
- password: `demo123456`

密码以 hash 形式写入数据库。

## 启动 Backend

```powershell
npm run start:dev
```

## 访问 Mobile

Mobile 建议本地运行：

```powershell
npm run dev --workspace apps/mobile
```

访问 `/showcase` 或 `/login`。

## 健康检查

```powershell
curl http://localhost:3000/api/v1/health/live
curl http://localhost:3000/api/v1/health/ready
curl http://localhost:3000/api/v1/health/modules
curl http://localhost:3000/api/v1/health/metrics
```
