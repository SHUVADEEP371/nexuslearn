import { RequestHandler } from 'express';

/** Parse the Cookie header into req.cookies before auth routes are mounted. */
export const cookieParser: RequestHandler = (req, _res, next) => {
  const parsed: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const part of (req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name || Object.prototype.hasOwnProperty.call(parsed, name)) continue;
    const value = part.slice(separator + 1).trim();
    try { parsed[name] = decodeURIComponent(value); } catch { /* Ignore malformed cookies. */ }
  }
  (req as typeof req & { cookies: Record<string, string> }).cookies = parsed;
  next();
};
