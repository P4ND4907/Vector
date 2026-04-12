# -----------------------------------------------------------------------
# app/Dockerfile – Multi-stage build for the Vite frontend served via nginx
# -----------------------------------------------------------------------

# --- Stage 1: builder ---------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /build

# Build-time arguments (passed via docker-compose build-args)
ARG VITE_API_BASE_URL=http://localhost:8787
ARG VITE_MOCK_MODE=false

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MOCK_MODE=$VITE_MOCK_MODE

# Install dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source files and build
COPY . .
RUN npm run build

# --- Stage 2: nginx static server ---------------------------------------
FROM nginx:1.27-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend assets
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 4173

CMD ["nginx", "-g", "daemon off;"]
