import app from './app';
import { connectWithRetry } from '../config/database';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function startServer() {
  try {
    console.log('[Server Init] Connecting to PostgreSQL database...');
    await connectWithRetry(10, 1000);

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Livestock Management API Server running on port ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 API Base:     http://localhost:${PORT}/api/v1`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('[Server Init Fatal Error] Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

startServer();
