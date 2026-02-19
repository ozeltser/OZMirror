# Build stage — compiles TypeScript and native modules (better-sqlite3)
FROM node:18-alpine AS builder

WORKDIR /app

# Build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# Native deps stage — production-only npm install with build tools
FROM node:18-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

# Production stage — clean image, no build tools
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache curl

# Copy production node_modules (with pre-built native bindings) from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy compiled JS from builder stage
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

CMD ["node", "dist/server.js"]
