# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build tools needed for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install runtime deps for native modules and health check
RUN apk add --no-cache curl python3 make g++

# Copy package files
COPY package*.json ./

# Install only production dependencies (rebuilds native modules)
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Run application
CMD ["node", "dist/server.js"]
