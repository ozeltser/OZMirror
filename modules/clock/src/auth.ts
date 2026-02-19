import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { logger } from './logger';

const API_KEY = process.env.API_KEY;

/**
 * Express middleware that validates the X-API-Key header.
 * Returns 401 if the key is missing or doesn't match.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    logger.warn('API_KEY not set — denying request');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const provided = req.header('X-API-Key');
  if (!provided) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(API_KEY);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
