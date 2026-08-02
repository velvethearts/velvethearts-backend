import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { env } from './config/env';
import { logger } from './utils/logger';
import apiRouter from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { initSocketServer } from './socket';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging Middleware
app.use((req, _res, next) => {
  logger.http(`${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});

// API Routes
app.use('/api/v1', apiRouter);

// Health Check Endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Velvet Hearts Backend Service is healthy',
    timestamp: new Date(),
  });
});

// 404 Route handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Requested resource not found',
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = env.PORT || 4000;

const server = createServer(app);
initSocketServer(server, env.CORS_ORIGIN);

server.listen(PORT, () => {
  logger.info(`🚀 Velvet Hearts Backend listening on port ${PORT} in ${env.NODE_ENV} mode`);
});

// Graceful Shutdown
const shutdown = () => {
  logger.info('Shutting down server gracefully...');
  server.close(() => {
    logger.info('Server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;


// Code for keeping this server alive on Render.com
const URL = process.env.URL!

async function ping() {
    try {
        const res = await fetch(URL);
        console.log(`[${new Date().toLocaleDateString()}] ${res.status}`);
    } catch (error: any) {
        console.error(error.message);
    }
}

setInterval(ping, 1 * 60 * 1000); // Ping every 1 minute

