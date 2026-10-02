# Build the website without including local settings or Windows dependencies.
FROM node:24.21.0-bookworm-slim AS frontend
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/index.html client/vite.config.js ./
COPY client/src ./src
COPY client/public ./public
ENV VITE_API_URL=/api VITE_API_TIMEOUT_MS=60000
RUN npm run build

FROM node:24.21.0-bookworm-slim AS backend
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24.21.0-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends libfontconfig1 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
ENV NODE_ENV=production PORT=8080
COPY --from=backend /build/server/node_modules ./node_modules
COPY server/package.json server/package-lock.json server/server.js server/app.js server/constants.js ./
COPY server/config ./config
COPY server/controllers ./controllers
COPY server/data ./data
COPY server/middleware ./middleware
COPY server/models ./models
COPY server/routes ./routes
COPY server/services ./services
COPY server/utils ./utils
COPY server/scripts ./scripts
COPY --from=frontend /build/client/dist ./public
RUN mkdir -p samples && chown node:node samples
USER node
EXPOSE 8080
CMD ["node", "server.js"]
