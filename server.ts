/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main Entry Point — VERTIKAL SMA JAWARA 28
 * Delegates all API routing, RBAC, database transactions, and business logic
 * to the modular backend in `server/src/`.
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { env } from './server/src/config/env.ts';
import { getDb } from './server/src/database/client.ts';
import { seedDevelopmentDemoData, seedProductionAdmin } from './server/src/database/seed.ts';
import { JawaraApplication, mountJawaraRoutesOnExpress } from './server/src/app.ts';

async function startServer() {
  const db = getDb();
  if (env.allowDemoSeed) {
    seedDevelopmentDemoData(db);
  } else {
    seedProductionAdmin(db);
  }

  const jawaraApp = new JawaraApplication(db);
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Mount modular API routes (/api/*)
  mountJawaraRoutesOnExpress(app, jawaraApp);

  // Vite dev middleware or static production build
  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(
      `VERTIKAL SMA JAWARA 28 Modular Server running at http://0.0.0.0:${env.port} [env=${env.nodeEnv}, dialect=${env.dbDialect}]`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
