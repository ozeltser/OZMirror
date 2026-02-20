# Build stage — needs build tools for better-sqlite3 native bindings
FROM node:18-alpine AS builder

WORKDIR /app

# Install build tools for native module compilation
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (compiles better-sqlite3 native bindings)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript, then prune to production deps only
RUN npm run build && npm prune --production

# Production stage — copy pre-compiled node_modules from builder
FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy pre-compiled node_modules (includes native better-sqlite3 .node file)
COPY --from=builder /app/node_modules ./node_modules

# Copy built files and package metadata
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Run application
CMD ["node", "dist/server.js"]
