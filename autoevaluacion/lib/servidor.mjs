import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

export function puertoLibre() {
  return new Promise((resolver, rechazar) => {
    const servidor = createServer();

    servidor.unref();
    servidor.on('error', rechazar);

    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address();
      servidor.close(() => resolver(port));
    });
  });
}

export function iniciarServidor({ cwd, puerto, dbPath }) {
  const env = {
    ...process.env,
    PORT: String(puerto),
  };

  if (dbPath) {
    env.DB_PATH = dbPath;
  }

  const proceso = spawn(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', 'src/servidor.js'],
    {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    },
  );

  proceso.on('error', (error) => {
    console.error('No se pudo iniciar el servidor:', error.message);
  });

  proceso.stdout.resume();

  proceso.stderr.on('data', (datos) => {
    process.stderr.write(datos);
  });

  return proceso;
}

export async function detenerServidor(proceso) {
  if (!proceso || !proceso.pid || proceso.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise((resolver) => {
      const cierre = spawn(
        'taskkill',
        ['/pid', String(proceso.pid), '/T', '/F'],
        { stdio: 'ignore' },
      );

      cierre.on('error', resolver);
      cierre.on('close', resolver);
    });
  } else {
    try {
      process.kill(-proceso.pid, 'SIGTERM');
    } catch {}
  }

  const inicio = Date.now();

  while (proceso.exitCode === null && Date.now() - inicio < 5000) {
    await delay(100);
  }

  if (proceso.exitCode === null && process.platform !== 'win32') {
    try {
      process.kill(-proceso.pid, 'SIGKILL');
    } catch {}
  }
}

export async function esperarSalud(base, timeoutMs = 30000) {
  const inicio = Date.now();

  while (Date.now() - inicio < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        return true;
      }
    } catch {}

    await delay(300);
  }

  return false;
}

export function crearCliente(base) {
  return async function pedir(ruta, opciones = {}) {
    const { body, headers, ...resto } = opciones;

    const res = await fetch(`${base}${ruta}`, {
      ...resto,
      headers: {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const texto = await res.text();
    let datos = null;

    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = texto;
    }

    return {
      status: res.status,
      datos,
    };
  };
}

export function codigoUnico(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}