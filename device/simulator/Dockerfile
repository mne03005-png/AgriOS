FROM node:22.17.1-alpine3.22
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY simulator.js ./
CMD ["node", "simulator.js"]
