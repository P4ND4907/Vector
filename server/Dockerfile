# -----------------------------------------------------------------------
# server/Dockerfile – Multi-stage build for the Express backend
# -----------------------------------------------------------------------

# --- Stage 1: builder ---------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /build

# Install dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc --project tsconfig.json

# --- Stage 2: runtime ---------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Only install production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output from builder stage
COPY --from=builder /build/dist ./dist

# Data directory for persistent storage
RUN mkdir -p /data

EXPOSE 8787

CMD ["node", "dist/index.js"]
