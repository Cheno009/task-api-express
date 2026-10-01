import 'dotenv/config';
import type { Server } from 'node:http';
import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { loadEnvironment } from './config/env.js';

const SHUTDOWN_TIMEOUT_MS = 10000;

let server: Server | undefined;
let isShuttingDown = false;

const closeHttpServer = (httpServer: Server): Promise<void> => {
  return new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    // close() deja de aceptar conexiones nuevas; esto libera las keep-alive inactivas.
    httpServer.closeIdleConnections();
  });
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`Señal ${signal} recibida. Cerrando la API...`);

  // Si algo se queda colgado, se fuerza la salida sin imprimir detalles.
  const forceExit = setTimeout(() => {
    console.error('El cierre tardó demasiado. Terminando el proceso.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  let hadError = false;

  // Primero HTTP: así ninguna solicitud nueva llega cuando MongoDB ya está cerrado.
  if (server) {
    try {
      await closeHttpServer(server);
      console.log('Servidor HTTP cerrado.');
    } catch {
      hadError = true;
      console.error('No fue posible cerrar el servidor HTTP correctamente.');
    }
  }

  // MongoDB se cierra aunque el paso anterior falle, para no dejar el proceso colgado.
  try {
    await disconnectDatabase();
  } catch {
    hadError = true;
    console.error('No fue posible cerrar la conexión con MongoDB correctamente.');
  }

  clearTimeout(forceExit);
  process.exitCode = hadError ? 1 : 0;
};

const registerShutdownHandlers = (): void => {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }
};

const startServer = async (): Promise<void> => {
  try {
    const env = loadEnvironment();
    await connectDatabase({
      uri: env.mongodbUri,
      dbName: env.mongodbDbName
    });
    server = app.listen(env.port, (error?: Error) => {
      // Express 5 entrega aquí los errores de listen (por ejemplo, puerto ocupado).
      if (error) {
        console.error(`No fue posible escuchar en el puerto ${env.port}.`);
        process.exitCode = 1;
        void disconnectDatabase().catch(() => undefined);
        return;
      }
      console.log(`API disponible en http://localhost:${env.port}`);
    });
    // Durante el cierre, se pide al cliente no reutilizar la conexión keep-alive.
    server.on('request', (_request, response) => {
      if (isShuttingDown) {
        response.setHeader('Connection', 'close');
      }
    });
    registerShutdownHandlers();
  } catch {
    console.error(
      'No fue posible iniciar la API. Revise MONGODB_URI, ' +
      'el usuario y la lista de acceso de red.'
    );
    process.exitCode = 1;
  }
};

void startServer();
