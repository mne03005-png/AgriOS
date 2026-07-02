FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npx prisma generate --schema apps/backend/prisma/schema.prisma
RUN npm run build --workspace apps/backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/backend/package.json apps/backend/package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/apps/backend/prisma apps/backend/prisma
WORKDIR /app/apps/backend
CMD ["node", "dist/main.js"]
