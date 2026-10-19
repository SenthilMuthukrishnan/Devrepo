import { apiApp } from './app';
import { initDatabase } from './db';
import { db } from './database';

const PORT = Number(process.env.PORT || 3001);

// Schema creation runs before the port opens, so no request can arrive against
// a half-initialised database (Postgres needs a round trip; SQLite is instant).
await initDatabase();

apiApp.listen(PORT, '0.0.0.0', () => {
  console.log(`BioPulse 15 API Server running on http://0.0.0.0:${PORT} (${db.kind})`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    console.log(`[server] ${signal} received, closing database`);
    try {
      await db.close();
    } finally {
      process.exit(0);
    }
  });
}
