import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from '../routes';
import { corsOrigins, trustProxySetting } from '../lib/server-security';
import { errorHandler } from '../middleware/error.middleware';

const app = express();

// Security headers with Helmet
app.use(helmet());

// CORS configuration
// Behind nginx on the same machine the caller's address comes from the proxy, never from a header the caller sent.
app.set('trust proxy', trustProxySetting(process.env));

app.use(cors({
  origin: corsOrigins(process.env),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // A renewed sign-in (src/middleware/auth.middleware.ts).
  exposedHeaders: ['X-Session-Token']
}));

// Request body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger middleware
app.use((req: Request, res: Response, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'cc-livestock-api'
  });
});

// API Routes
app.use('/api/v1', routes);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    data: null
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
