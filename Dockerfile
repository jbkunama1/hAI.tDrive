FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN mkdir -p dist && echo '/* plain JS */' > dist/index.js

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/index.js"]
