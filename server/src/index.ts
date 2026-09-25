import 'dotenv/config';
import express, { ErrorRequestHandler, Router } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createAISessionRoutes } from './routes/aiSession.routes';
import { authRouter } from './controllers/auth.controller';
import { matchingRoutes } from './routes/matching.routes';
import { userRoutes } from './routes/user.routes';
import { paymentRoutes } from './routes/payment.routes';
import { skillRoutes } from './routes/skill.routes';
import { sessionRouter } from './controllers/session.controller';
import { installSessionSocket } from './realtime/session.socket';
import { createSharedRateLimitStore, redisClient } from './infra/redis';
import { cookieParser } from './middleware/cookieParser';

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT || 5000);
const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '');
const allowedOrigins = new Set((process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',').map(normalizeOrigin).filter(Boolean));
const isAllowedOrigin = (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void): void => {
  callback(null, !origin || allowedOrigins.has(normalizeOrigin(origin)));
};
let redisSubscriber: typeof redisClient = null;
let shutdownPromise: Promise<void> | null = null;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { scriptSrc: ["'self'", 'https://checkout.razorpay.com'], frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'] } } }));
app.use(cors({ origin: isAllowedOrigin, credentials: true }));

// Keep the external monitor endpoint ahead of rate limiting and all auth routers.
app.get('/health', (_req, res) => res.status(200).json({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

app.use(cookieParser);
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(mongoSanitize({ replaceWith: '_' }));
app.use(rateLimit({ windowMs: 15 * 60_000, limit: 200, standardHeaders: true, legacyHeaders: false, passOnStoreError: true, store: createSharedRateLimitStore('nexuslearn:api:') }));
app.use('/uploads', express.static('uploads', { dotfiles: 'deny', index: false, maxAge: '1h' }));

const legacy = (path: string): Router => require(path) as Router;
app.use('/api/auth', authRouter);
app.use('/api/users', userRoutes);
app.use('/api/users', legacy('../routes/users'));
app.use('/api/swaps', legacy('../routes/swaps'));
app.use('/api/skills', skillRoutes);
app.use('/api/sessions', sessionRouter);
app.use('/api/payments', paymentRoutes);
app.use('/api/matching', matchingRoutes);

const io = new Server(httpServer, {
  cors: { origin: isAllowedOrigin, credentials: true },
  maxHttpBufferSize: 256_000,
  // WebSocket-only avoids Engine.IO polling affinity requirements behind least_conn.
  transports: ['websocket'],
});
installSessionSocket(io);
app.use('/api/ai', createAISessionRoutes(io));

app.get('/api/health', (_req, res) => res.json({ status: 'OK', service: 'NexusLearn API', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = typeof error?.status === 'number' && error.status >= 400 && error.status < 600 ? error.status : 500;
  if (status >= 500) console.error('Unhandled API error', error instanceof Error ? error.name : 'UnknownError');
  res.status(status).json({ message: status === 500 ? 'Something went wrong' : error.message });
};
app.use(errors);

async function start(): Promise<void> {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured');
  try {
    // MongoDB's driver parses percent-encoded username/password components.
    // Pass the URI through unchanged; decoding it here would corrupt credentials.
    await mongoose.connect(process.env.MONGODB_URI.trim());
  } catch (error) {
    logMongoConnectionFailure(error);
    throw error;
  }

  if (process.env.REDIS_URL) {
    if (!redisClient) throw new Error('Redis client could not be initialized');
    const publisher = redisClient;
    const subscriber = publisher.duplicate();
    redisSubscriber = subscriber;
    publisher.on('error', (error) => console.error('Redis publisher error', error.name));
    subscriber.on('error', (error) => console.error('Redis subscriber error', error.name));
    try {
      await Promise.all([publisher.connect(), subscriber.connect()]);
    } catch (error) {
      console.error('Redis unavailable at startup; continuing with request fallbacks', error instanceof Error ? error.name : 'UnknownError');
    }
    io.adapter(createAdapter(publisher, subscriber));
  }

  await new Promise<void>((resolve) => httpServer.listen(port, '0.0.0.0', resolve));
  console.log(`NexusLearn API listening on port ${port}`);
}

function logMongoConnectionFailure(error: unknown): void {
  const failure = error instanceof Error ? error : new Error(String(error));
  const nested = failure.cause instanceof Error ? failure.cause : undefined;
  const failureDetails = failure as Error & { code?: string | number; errorResponse?: { code?: string | number } };
  const nestedDetails = nested as (Error & { code?: string | number; errorResponse?: { code?: string | number } }) | undefined;
  const code = failureDetails.errorResponse?.code
    || nestedDetails?.errorResponse?.code
    || nestedDetails?.code
    || failureDetails.code;
  const message = `${failure.message} ${nested?.message || ''}`;
  console.error('MongoDB connection failed:', failure.name, code || 'no error code');
  if (Number(code) === 8000) {
    console.error('MongoDB authentication failed (MongoServerError 8000). Check the database username, password, and database-user permissions. Percent-encode reserved credential characters in MONGODB_URI (for example, @ as %40); do not decode the URI before passing it to Mongoose.');
  }
  if (code === 'ENOTFOUND' || /querySrv\s+ENOTFOUND|querySrv ETIMEOUT/i.test(message)) {
    console.error('MongoDB SRV DNS lookup failed. Check local DNS/network access, try a trusted DNS resolver such as Google DNS (8.8.8.8), or use a standard mongodb:// URI listing all three replica-set seed hosts and the replicaSet option.');
  }
}

let mongoConnectedOnce = false;
mongoose.connection.on('connected', () => {
  mongoConnectedOnce = true;
  console.info('MongoDB connection established.');
});
mongoose.connection.on('disconnected', () => {
  if (mongoConnectedOnce) console.warn('MongoDB connection lost; Mongoose will attempt to reconnect.');
  else console.warn('MongoDB is disconnected during initial startup.');
});
mongoose.connection.on('reconnected', () => {
  console.info('MongoDB connection re-established.');
});
mongoose.connection.on('error', (error: Error & { code?: number }) => {
  if (error.code === 8000) logMongoConnectionFailure(error);
});

async function shutdown(signal: string): Promise<void> {
  return shutdownWithExitCode(signal, 0);
}

async function shutdownWithExitCode(reason: string, exitCode: number): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.log(`Received ${reason}; draining server resources`);
    const forceCloseTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out; closing remaining HTTP connections');
      httpServer.closeAllConnections();
    }, 10_000);
    forceCloseTimer.unref();

    const socketServerClosed = new Promise<void>((resolve) => {
      try { io.close(() => resolve()); }
      catch { resolve(); }
    });
    const externalResourcesClosed = Promise.allSettled([
      mongoose.connection.close(),
      closeRedisClient(redisSubscriber),
      closeRedisClient(redisClient),
    ]).then(() => undefined);

    await Promise.race([
      Promise.all([socketServerClosed, externalResourcesClosed]),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);
    clearTimeout(forceCloseTimer);
    process.exit(exitCode);
  })();
  return shutdownPromise;
}

async function closeRedisClient(client: typeof redisClient): Promise<void> {
  if (!client || client.status === 'end') return;
  try {
    if (client.status === 'wait') { client.disconnect(); return; }
    await client.quit();
  } catch {
    client.disconnect();
  }
}

const describeRuntimeError = (error: unknown): string =>
  error instanceof Error ? error.stack || error.message : String(error);

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Promise Rejection detected:', describeRuntimeError(reason));
  void shutdownWithExitCode('unhandledRejection', 1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught exception; draining and restarting the process:', describeRuntimeError(error));
  void shutdownWithExitCode('uncaughtException', 1);
});

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
start().catch(async (error: unknown) => {
  console.error('NexusLearn startup failed:', describeRuntimeError(error));
  await shutdownWithExitCode('startup failure', 1);
});
