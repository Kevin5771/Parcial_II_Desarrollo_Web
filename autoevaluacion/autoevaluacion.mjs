#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { puertoLibre } from './lib/servidor.mjs';
import {
  detectarNavegador,
  instruccionesNavegador,
  variablesDeEntorno,
} from './lib/navegador.mjs';

const AQUI = import.meta.dirname;
const PROYECTO = resolve(process.env.ALUMNO_DIR ?? process.cwd());
const PESO_SERIE = 7.5;

function ayuda() {
  console.log(`
Uso: npm run autoevaluacion [-- --variante A|B] [--solo-backend]

  --variante      A o B. Si no se indica, se lee autoevaluacion/variante.txt.
  --solo-backend  Ejecuta únicamente las pruebas de la API (no requiere Chromium).
`);
}

function leerArgumentos(argv) {
  const args = { variante: null, soloBackend: false };
  for (let i = 0; i < argv.length; i += 1) {
    const actual = argv[i];
    if (actual === '--variante') args.variante = (argv[(i += 1)] ?? '').toUpperCase();
    else if (actual === '--solo-backend') args.soloBackend = true;
    else if (actual === '-h' || actual === '--ayuda') {
      ayuda();
      process.exit(0);
    }
  }
  return args;
}

async function variantePorDefecto() {
  const archivo = join(AQUI, 'variante.txt');
  if (!existsSync(archivo)) return null;
  const valor = (await readFile(archivo, 'utf8')).trim().toUpperCase();
  return ['A', 'B'].includes(valor) ? valor : null;
}

function matar(proceso) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-proceso.pid, 'SIGTERM');
    } catch {}
    setTimeout(() => {
      try {
        process.kill(-proceso.pid, 'SIGKILL');
      } catch {}
    }, 4000);
  }
}

function ejecutar(comando, args, { cwd, env, timeout } = {}) {
  return new Promise((resolver) => {
    const proceso = spawn(comando, args, {
      cwd,
      env: { ...process.env, ...(env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });

    let stdout = '';
    let stderr = '';
    let excedido = false;

    proceso.stdout.on('data', (dato) => {
      stdout += dato;
    });
    proceso.stderr.on('data', (dato) => {
      stderr += dato;
    });

    const temporizador = timeout
      ? setTimeout(() => {
          excedido = true;
          matar(proceso);
        }, timeout)
      : null;

    proceso.on('close', (codigo) => {
      if (temporizador) clearTimeout(temporizador);
      resolver({ codigo, stdout, stderr, excedido });
    });
  });
}

function parsearTap(texto) {
  const pruebas = [];
  for (const linea of texto.split('\n')) {
    const coincidencia = linea.match(/^(not )?ok \d+ - (.+?)(?: #.*)?$/);
    if (coincidencia) {
      pruebas.push({ ok: !coincidencia[1], nombre: coincidencia[2].trim() });
    }
  }
  return pruebas;
}

function recolectarSpecs(suites, salida = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      salida.push({ ok: Boolean(spec.ok), nombre: spec.title });
    }
    recolectarSpecs(suite.suites, salida);
  }
  return salida;
}

function nota(pruebas) {
  if (pruebas.length === 0) return 0;
  return (PESO_SERIE * pruebas.filter((p) => p.ok).length) / pruebas.length;
}

function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

function imprimirLista(titulo, pruebas, puntaje) {
  const aprobadas = pruebas.filter((p) => p.ok).length;
  console.log(
    `\n${titulo}: ${redondear(puntaje).toFixed(2)} / ${PESO_SERIE.toFixed(2)}  (${aprobadas}/${pruebas.length})`,
  );
  for (const prueba of pruebas) {
    console.log(`  ${prueba.ok ? '[OK]   ' : '[FALLO]'} ${prueba.nombre}`);
  }
}



async function main() {
  const args = leerArgumentos(process.argv.slice(2));
  const variante = args.variante ?? (await variantePorDefecto());

  if (!variante) {
    console.error('No se pudo determinar la variante. Usa: npm run autoevaluacion -- --variante A');
    process.exit(1);
  }
  if (!existsSync(join(PROYECTO, 'package.json'))) {
    console.error(`No hay package.json en ${PROYECTO}. Ejecuta el comando dentro de la carpeta proyecto.`);
    process.exit(1);
  }

  const minúscula = variante.toLowerCase();
  const raiz = await mkdtemp(join(tmpdir(), 'autoevaluacion-'));
  const dbPath = join(raiz, 'autoevaluacion.db');

  console.log(`\nAUTOEVALUACIÓN — VARIANTE ${variante}`);
  console.log(`Proyecto: ${PROYECTO}\n`);
  console.log('Ejecutando pruebas de la API (Serie I)...');

  const backend = await ejecutar(
    process.execPath,
    ['--test', '--test-reporter=tap', join('autoevaluacion', 'backend', `variante-${minúscula}.pruebas.mjs`)],
    {
      cwd: PROYECTO,
      env: {
        ALUMNO_DIR: PROYECTO,
        PUERTO: String(await puertoLibre()),
        DB_PATH: dbPath,
      },
      timeout: 300_000,
    },
  );
  const pruebasBackend = parsearTap(backend.stdout);

  let pruebasFrontend = [];
  let frontendSaltado = false;

  const navegador = args.soloBackend ? null : await detectarNavegador();

  if (args.soloBackend) {
    frontendSaltado = true;
  } else if (!navegador) {
    frontendSaltado = true;
    console.log(`\n${instruccionesNavegador()}`);
  } else {
    console.log(`\nEjecutando pruebas de interfaz (Serie II) con ${navegador.valor ?? 'Chromium de Playwright'}...`);
    const jsonPath = join(raiz, 'playwright.json');
    const frontend = await ejecutar(
      process.execPath,
      [
        join(PROYECTO, 'node_modules', '@playwright', 'test', 'cli.js'),
        'test',
        `variante-${minúscula}.spec.mjs`,
        '--config',
        join('autoevaluacion', 'frontend', 'playwright.config.mjs'),
      ],
      {
        cwd: PROYECTO,
        env: {
          ALUMNO_DIR: PROYECTO,
          PUERTO: String(await puertoLibre()),
          DB_PATH: dbPath,
          PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath,
          ...variablesDeEntorno(navegador),
        },
        timeout: 600_000,
      },
    );

    try {
      const reporte = JSON.parse(await readFile(jsonPath, 'utf8'));
      pruebasFrontend = recolectarSpecs(reporte.suites);
    } catch {
      try {
        pruebasFrontend = recolectarSpecs(JSON.parse(frontend.stdout).suites);
      } catch {
        pruebasFrontend = [];
      }
    }

    if (pruebasFrontend.length === 0) {
      console.log('No se obtuvieron resultados de la Serie II. Últimas líneas del error:');
      console.log((frontend.stderr || frontend.stdout).trim().split('\n').slice(-10).join('\n'));
    }
  }

  const puntajeBackend = nota(pruebasBackend);
  const puntajeFrontend = nota(pruebasFrontend);

  console.log(`\n${'='.repeat(56)}`);
  imprimirLista('SERIE I — API + SQLite', pruebasBackend, puntajeBackend);
  if (!frontendSaltado) {
    imprimirLista('SERIE II — Interfaz', pruebasFrontend, puntajeFrontend);
  } else {
    console.log('\nSERIE II — Interfaz: no evaluada en esta ejecución.');
  }

  if (pruebasBackend.length === 0) {
    console.log('\nAviso: no se obtuvieron resultados de la Serie I.');
    console.log((backend.stderr || backend.stdout).trim().split('\n').slice(-10).join('\n'));
  }

  if (!frontendSaltado) {
    const total = redondear(puntajeBackend + puntajeFrontend);
    console.log(`\nNOTA APROXIMADA: ${total.toFixed(2)} / 15.00`);
  } else {
    console.log(`\nPUNTAJE PARCIAL (solo Serie I): ${redondear(puntajeBackend).toFixed(2)} / 7.50`);
  }
  console.log('Recuerda: la calificación oficial la realiza el catedrático con el mismo contrato.');
  console.log(`${'='.repeat(56)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
