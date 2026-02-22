# Module Development Guide

This guide explains how to build a new OZMirror module. Every module is a self-contained Docker container that exposes a REST API, publishes real-time data via Redis pub/sub, and registers itself with the Config Service on startup.

The clock module (`modules/clock/`) is the reference implementation. This guide walks through its structure and explains how to create your own.

## Module Directory Layout

```
modules/your-module/
  Dockerfile              # Multi-stage build (build + production)
  package.json            # Node.js dependencies and scripts
  tsconfig.json           # TypeScript compiler config
  src/
    server.ts             # Express server entry point
    routes.ts             # REST endpoint handlers
    manifest.ts           # Module metadata and config schema
    config-client.ts      # Config Service HTTP client
    redis-client.ts       # Redis pub/sub publisher
```

## Required Files

### 1. `src/manifest.ts` -- Module Metadata

The manifest defines your module's identity, default configuration, config schema (JSON Schema), and grid constraints. It is used for both Config Service registration and the `GET /manifest` endpoint.

```typescript
import { DEFAULT_CONFIG } from './config-client';

const MODULE_ID = process.env.MODULE_ID ?? 'your_module';

export const MANIFEST = {
  id: MODULE_ID,
  name: 'Your Module',
  description: 'A brief description of what this module does',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'your-icon-name',       // Icon identifier used by the UI
  defaultConfig: DEFAULT_CONFIG,
  configSchema: {
    type: 'object',
    properties: {
      exampleSetting: {
        type: 'string',
        description: 'An example setting',
        default: 'hello',
      },
      refreshInterval: {
        type: 'number',
        description: 'Update interval in seconds',
        default: 60,
      },
    },
    required: ['exampleSetting', 'refreshInterval'],
  },
  gridConstraints: {
    minW: 2,    // Minimum grid columns
    minH: 2,    // Minimum grid rows
    maxW: 8,    // Maximum grid columns
    maxH: 4,    // Maximum grid rows
    defaultW: 4, // Default width when added
    defaultH: 3, // Default height when added
  },
};
```

The `configSchema` uses standard [JSON Schema](https://json-schema.org/) and powers the auto-generated settings form in the UI. Supported field types: `string`, `number`, `boolean`. The UI renders text inputs, number inputs, and checkboxes accordingly.

### 2. `src/config-client.ts` -- Config Service Client

Handles module registration and per-instance config fetching.

```typescript
import axios from 'axios';
import { MANIFEST } from './manifest';

const CONFIG_SERVICE_URL = process.env.CONFIG_SERVICE_URL ?? 'http://config-service:8000';
const API_KEY = process.env.API_KEY ?? '';
const MODULE_ID = process.env.MODULE_ID ?? 'your_module';

// Define your config interface and defaults
export interface YourModuleConfig {
  exampleSetting: string;
  refreshInterval: number;
}

export const DEFAULT_CONFIG: YourModuleConfig = {
  exampleSetting: 'hello',
  refreshInterval: 60,
};

/**
 * Register this module with the Config Service.
 * Retries up to 5 times with exponential back-off.
 */
export async function registerModule(serviceUrl: string): Promise<void> {
  const body = {
    id: MODULE_ID,
    name: MANIFEST.name,
    serviceUrl,
    manifest: MANIFEST,
    status: 'online',
  };

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await axios.post(
        `${CONFIG_SERVICE_URL}/api/config/modules/register`,
        body,
        { headers: { 'X-API-Key': API_KEY }, timeout: 5000 }
      );
      console.log('[config-client] Module registered successfully');
      return;
    } catch (err) {
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[config-client] Registration attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  console.error('[config-client] Module registration failed after 5 attempts');
}

const INSTANCE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Fetch config for a specific widget instance from Config Service.
 */
export async function fetchInstanceConfig(instanceId: string): Promise<YourModuleConfig> {
  if (!INSTANCE_ID_PATTERN.test(instanceId)) {
    return DEFAULT_CONFIG;
  }
  try {
    const { data } = await axios.get<YourModuleConfig>(
      `${CONFIG_SERVICE_URL}/api/config/modules/${encodeURIComponent(MODULE_ID)}/config/${encodeURIComponent(instanceId)}`,
      { timeout: 3000 }
    );
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return DEFAULT_CONFIG;
  }
}
```

**Registration flow**: On startup, the module POSTs its manifest to `POST /api/config/modules/register`. The Config Service upserts the record. If the Config Service is not yet ready (common during cold start), the client retries with exponential back-off. Registration is fire-and-forget -- the module's REST API still works without it.

### 3. `src/redis-client.ts` -- Redis Publisher

Publishes real-time data updates to a Redis channel. The WebSocket Bridge subscribes to these channels and pushes updates to connected browsers.

```typescript
import { createClient, RedisClientType } from 'redis';
import { YourModuleConfig } from './config-client';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';

// Channel must match the pattern: module:<module_id>:<detail>
const CHANNEL = 'module:your_module:data';

let publisher: RedisClientType | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

const instanceConfigs = new Map<string, YourModuleConfig>();

export function setInstanceConfig(instanceId: string, config: YourModuleConfig): void {
  instanceConfigs.set(instanceId, config);
}

export async function connectRedis(): Promise<void> {
  publisher = createClient({
    url: REDIS_URL,
    password: REDIS_PASSWORD || undefined,
  }) as RedisClientType;

  publisher.on('error', (err) => console.error('[redis-client] Error:', err));
  await publisher.connect();
}

export function startPublishing(): void {
  if (!publisher) return;

  intervalHandle = setInterval(async () => {
    for (const [instanceId, config] of instanceConfigs) {
      const data = buildYourData(config); // Your data-building logic
      const payload = JSON.stringify({
        instanceId,
        data,
        timestamp: Date.now(),
      });
      try {
        await publisher!.publish(CHANNEL, payload);
      } catch (err) {
        console.error('[redis-client] Publish error:', err);
      }
    }
  }, 1000); // Adjust interval to your needs
}

export async function disconnectRedis(): Promise<void> {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}
```

**Channel naming**: Channels must follow the pattern `module:<module_id>:<detail>`. The WebSocket Bridge enforces a regex whitelist. See [REDIS_CHANNELS.md](REDIS_CHANNELS.md) for the full specification.

**Payload format**:

```json
{
  "instanceId": "your_module_01",
  "data": { /* module-specific data */ },
  "timestamp": 1708012345000
}
```

### 4. `src/routes.ts` -- REST Endpoints

Every module must implement these three endpoints:

```typescript
import { Router, Request, Response } from 'express';
import { MANIFEST } from './manifest';
import { fetchInstanceConfig, DEFAULT_CONFIG } from './config-client';

const router = Router();
const startTime = Date.now();

// GET /health -- liveness probe (used by Docker healthcheck)
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '1.0.0',
  });
});

// GET /manifest -- module metadata and config schema
router.get('/manifest', (_req: Request, res: Response) => {
  res.json(MANIFEST);
});

// GET /data?instanceId=<id> -- current module data for a widget instance
router.get('/data', async (req: Request, res: Response) => {
  const instanceId = typeof req.query.instanceId === 'string'
    ? req.query.instanceId
    : 'your_module_01';

  const config = await fetchInstanceConfig(instanceId).catch(() => DEFAULT_CONFIG);
  const data = buildYourData(config); // Your data-building logic
  res.json(data);
});

export default router;
```

### 5. `src/server.ts` -- Entry Point

```typescript
import express from 'express';
import { connectRedis, startPublishing, disconnectRedis } from './redis-client';
import { registerModule } from './config-client';
import routes from './routes';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const MODULE_ID = process.env.MODULE_ID ?? 'your_module';

const app = express();
app.use(express.json());
app.use('/', routes);

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[server] ${MODULE_ID} module listening on port ${PORT}`);

  // Connect to Redis and start publishing
  try {
    await connectRedis();
    startPublishing();
  } catch (err) {
    console.error('[server] Failed to connect to Redis:', err);
  }

  // Register with Config Service (retries internally)
  const serviceUrl = `http://${MODULE_ID}-module:${PORT}`;
  registerModule(serviceUrl).catch((err) =>
    console.error('[server] Background registration error:', err)
  );
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received`);
  const forceTimer = setTimeout(() => process.exit(1), 10_000);

  server.close(async () => {
    await disconnectRedis();
    clearTimeout(forceTimer);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

**Lifecycle**:

1. Start Express server on port 3001
2. Connect to Redis
3. Begin publishing data updates on a timer
4. Register with Config Service (fire-and-forget with retries)
5. On SIGTERM/SIGINT: stop publishing, close Redis, shut down Express

### 6. `package.json`

```json
{
  "name": "ozmirror-your-module",
  "version": "1.0.0",
  "description": "Your module for OzMirror",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "redis": "^4.6.5",
    "axios": "^1.6.7"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "@types/express": "^4.17.21",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2"
  }
}
```

### 7. `Dockerfile`

Use a multi-stage build to keep the production image small:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1
CMD ["node", "dist/server.js"]
```

### 8. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "lib": ["ES2021"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Docker Compose Integration

Add your module to `docker-compose.yml`:

```yaml
  your_module-module:
    build:
      context: ./modules/your-module
      dockerfile: Dockerfile
    container_name: ozmirror-your-module
    environment:
      - MODULE_ID=your_module
      - CONFIG_SERVICE_URL=${CONFIG_SERVICE_URL}
      - REDIS_URL=${REDIS_URL}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - API_KEY=${API_KEY}
      - PORT=3001
    depends_on:
      redis:
        condition: service_healthy
      config-service:
        condition: service_healthy
    networks:
      - ozmirror-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
```

Key points:
- **Container naming**: The service name in Compose must be `<module_id>-module` (e.g., `your_module-module`). Nginx routes `/api/modules/your_module/*` to `your_module-module:3001` using Docker DNS.
- **`MODULE_ID`**: Must match the `id` in your manifest and the service name prefix.
- **Port**: Always 3001 inside the container. Nginx handles external routing.
- **Networks**: Must be on `ozmirror-network` to reach Redis and Config Service.
- **Health check**: Docker uses `GET /health` to determine container readiness.
- **Dependencies**: Always depend on `redis` and `config-service` with `condition: service_healthy`.

## WebSocket Bridge Channel Whitelist

After adding your module, update the channel whitelist in `services/websocket/src/server.ts`:

```typescript
const ALLOWED_MODULE_CHANNELS =
  /^module:(clock|weather|calendar|rss|system_stats|now_playing|sticky_notes|your_module):.+$/;
```

Then rebuild the WebSocket Bridge container.

## Example: Creating a Minimal "Hello World" Module

Below is a complete minimal module that publishes a greeting message every 5 seconds.

### 1. Create the directory

```bash
mkdir -p modules/hello/src
```

### 2. `modules/hello/src/config-client.ts`

```typescript
import axios from 'axios';

const CONFIG_SERVICE_URL = process.env.CONFIG_SERVICE_URL ?? 'http://config-service:8000';
const API_KEY = process.env.API_KEY ?? '';
const MODULE_ID = process.env.MODULE_ID ?? 'hello';

export interface HelloConfig {
  greeting: string;
}

export const DEFAULT_CONFIG: HelloConfig = { greeting: 'Hello, World!' };

export async function registerModule(serviceUrl: string): Promise<void> {
  const { MANIFEST } = await import('./manifest');
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await axios.post(
        `${CONFIG_SERVICE_URL}/api/config/modules/register`,
        { id: MODULE_ID, name: 'Hello', serviceUrl, manifest: MANIFEST, status: 'online' },
        { headers: { 'X-API-Key': API_KEY }, timeout: 5000 }
      );
      return;
    } catch {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}

export async function fetchInstanceConfig(instanceId: string): Promise<HelloConfig> {
  try {
    const { data } = await axios.get(
      `${CONFIG_SERVICE_URL}/api/config/modules/${MODULE_ID}/config/${instanceId}`,
      { timeout: 3000 }
    );
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return DEFAULT_CONFIG;
  }
}
```

### 3. `modules/hello/src/manifest.ts`

```typescript
import { DEFAULT_CONFIG } from './config-client';

export const MANIFEST = {
  id: process.env.MODULE_ID ?? 'hello',
  name: 'Hello',
  description: 'A minimal hello-world module',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'hand-wave',
  defaultConfig: DEFAULT_CONFIG,
  configSchema: {
    type: 'object',
    properties: {
      greeting: { type: 'string', description: 'Greeting message', default: 'Hello, World!' },
    },
    required: ['greeting'],
  },
  gridConstraints: { minW: 2, minH: 1, maxW: 6, maxH: 2, defaultW: 3, defaultH: 1 },
};
```

### 4. `modules/hello/src/redis-client.ts`

```typescript
import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
const CHANNEL = 'module:hello:data';

let publisher: RedisClientType | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function connectRedis(): Promise<void> {
  publisher = createClient({ url: REDIS_URL, password: REDIS_PASSWORD || undefined }) as RedisClientType;
  publisher.on('error', (err) => console.error('[redis] Error:', err));
  await publisher.connect();
}

export function startPublishing(greeting: string): void {
  if (!publisher) return;
  intervalHandle = setInterval(async () => {
    const payload = JSON.stringify({
      instanceId: 'hello_01',
      data: { message: greeting, time: new Date().toISOString() },
      timestamp: Date.now(),
    });
    await publisher!.publish(CHANNEL, payload).catch(console.error);
  }, 5000);
}

export async function disconnectRedis(): Promise<void> {
  if (intervalHandle) clearInterval(intervalHandle);
  if (publisher) await publisher.quit();
}
```

### 5. `modules/hello/src/routes.ts`

```typescript
import { Router, Request, Response } from 'express';
import { MANIFEST } from './manifest';
import { DEFAULT_CONFIG } from './config-client';

const router = Router();
const startTime = Date.now();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', uptime: Math.floor((Date.now() - startTime) / 1000), version: '1.0.0' });
});

router.get('/manifest', (_req: Request, res: Response) => {
  res.json(MANIFEST);
});

router.get('/data', (_req: Request, res: Response) => {
  res.json({ message: DEFAULT_CONFIG.greeting, time: new Date().toISOString() });
});

export default router;
```

### 6. `modules/hello/src/server.ts`

```typescript
import express from 'express';
import { connectRedis, startPublishing, disconnectRedis } from './redis-client';
import { registerModule, DEFAULT_CONFIG } from './config-client';
import routes from './routes';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const MODULE_ID = process.env.MODULE_ID ?? 'hello';

const app = express();
app.use(express.json());
app.use('/', routes);

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[server] Hello module listening on port ${PORT}`);
  try {
    await connectRedis();
    startPublishing(DEFAULT_CONFIG.greeting);
  } catch (err) {
    console.error('[server] Redis connection failed:', err);
  }
  registerModule(`http://${MODULE_ID}-module:${PORT}`).catch(console.error);
});

process.on('SIGTERM', () => {
  server.close(async () => { await disconnectRedis(); process.exit(0); });
});
```

### 7. Add to Docker Compose and WebSocket Bridge

Add the service to `docker-compose.yml` (see [Docker Compose Integration](#docker-compose-integration) above) and add `hello` to the WebSocket Bridge channel whitelist.

### 8. Build and run

```bash
make deploy
```

Your module will be accessible at `/api/modules/hello/health`, `/api/modules/hello/manifest`, and `/api/modules/hello/data`.

## Checklist for New Modules

- [ ] Created `modules/<name>/` directory with all required files
- [ ] Manifest includes `id`, `name`, `version`, `configSchema`, `gridConstraints`
- [ ] Config client registers on startup with retry logic
- [ ] Redis client publishes to `module:<id>:<detail>` channel
- [ ] Routes implement `GET /health`, `GET /manifest`, `GET /data`
- [ ] Dockerfile uses multi-stage build
- [ ] Service added to `docker-compose.yml` with correct naming and dependencies
- [ ] Module ID added to WebSocket Bridge channel whitelist
- [ ] Updated [REDIS_CHANNELS.md](REDIS_CHANNELS.md) with new channel patterns
- [ ] Tested with `make deploy`

## Related Documentation

- [Architecture Overview](ARCHITECTURE.md) -- system design and service topology
- [API Reference](API.md) -- REST and WebSocket endpoint specifications
- [Redis Channels](REDIS_CHANNELS.md) -- channel naming convention
