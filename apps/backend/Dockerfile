FROM node:22.17.1-alpine3.22 AS deps
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

FROM node:22.17.1-alpine3.22 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/backend/package.json apps/backend/package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/apps/backend/prisma apps/backend/prisma
RUN chown -R node:node /app
USER node
WORKDIR /app/apps/backend
CMD ["node", "dist/src/main.js"]
