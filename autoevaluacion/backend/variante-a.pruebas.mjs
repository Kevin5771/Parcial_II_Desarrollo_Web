import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  iniciarServidor,
  detenerServidor,
  esperarSalud,
  crearCliente,
  codigoUnico,
} from '../lib/servidor.mjs';

const ALUMNO_DIR = process.env.ALUMNO_DIR;
const PUERTO = Number(process.env.PUERTO ?? 3210);
const BASE = `http://127.0.0.1:${PUERTO}`;

let proceso;
let pedir;
let dbPath;

before(async () => {
  assert.ok(ALUMNO_DIR, 'Falta ALUMNO_DIR (carpeta del proyecto del alumno)');
  dbPath =
    process.env.DB_PATH ?? join(await mkdtemp(join(tmpdir(), 'calif-a-')), 'calificacion.db');

  proceso = iniciarServidor({ cwd: ALUMNO_DIR, puerto: PUERTO, dbPath });
  const listo = await esperarSalud(BASE);
  assert.ok(listo, `El servidor no respondió en ${BASE}/api/health (revise npm start)`);
  pedir = crearCliente(BASE);
});

after(async () => detenerServidor(proceso));

function producto(codigo, extra = {}) {
  return {
    codigo,
    nombre: 'Mouse',
    precio: 75.5,
    urlImagen: 'https://ejemplo.com/mouse.png',
    ...extra,
  };
}

async function crear(codigo, extra) {
  const res = await pedir('/api/productos', { method: 'POST', body: producto(codigo, extra) });
  assert.equal(res.status, 201, `POST /api/productos devolvió ${res.status}`);
  return res.datos;
}

test('[API] GET /api/health responde ok', async () => {
  const { status, datos } = await pedir('/api/health');
  assert.equal(status, 200);
  assert.equal(datos?.ok, true);
});

test('[CRUD] POST crea un producto', async () => {
  const codigo = codigoUnico('A');
  const datos = await crear(codigo, { nombre: 'Teclado' });
  assert.equal(datos?.codigo, codigo);
  assert.equal(datos?.nombre, 'Teclado');
  assert.equal(Number(datos?.precio), 75.5);
});

test('[CRUD] GET lista incluye el producto creado', async () => {
  const codigo = codigoUnico('A');
  await crear(codigo);
  const { status, datos } = await pedir('/api/productos');
  assert.equal(status, 200);
  assert.ok(Array.isArray(datos), 'GET /api/productos no devolvió un arreglo');
  assert.ok(datos.some((p) => p.codigo === codigo), 'el producto creado no aparece en la lista');
});

test('[CRUD] GET por código devuelve el producto', async () => {
  const codigo = codigoUnico('A');
  await crear(codigo, { nombre: 'Monitor' });
  const { status, datos } = await pedir(`/api/productos/${codigo}`);
  assert.equal(status, 200);
  assert.equal(datos?.nombre, 'Monitor');
});

test('[CRUD] PUT actualiza el producto', async () => {
  const codigo = codigoUnico('A');
  await crear(codigo);
  const res = await pedir(`/api/productos/${codigo}`, {
    method: 'PUT',
    body: producto(codigo, { nombre: 'Mouse Pro', precio: 99.9 }),
  });
  assert.equal(res.status, 200);
  const { datos } = await pedir(`/api/productos/${codigo}`);
  assert.equal(datos?.nombre, 'Mouse Pro');
  assert.equal(Number(datos?.precio), 99.9);
});

test('[CRUD] DELETE elimina el producto', async () => {
  const codigo = codigoUnico('A');
  await crear(codigo);
  const res = await pedir(`/api/productos/${codigo}`, { method: 'DELETE' });
  assert.ok([200, 204].includes(res.status), `DELETE devolvió ${res.status}`);
  const consulta = await pedir(`/api/productos/${codigo}`);
  assert.equal(consulta.status, 404);
});

test('[Validación] POST sin campos obligatorios devuelve 400', async () => {
  const vacio = await pedir('/api/productos', { method: 'POST', body: {} });
  assert.equal(vacio.status, 400);
  const parcial = await pedir('/api/productos', {
    method: 'POST',
    body: { codigo: codigoUnico('A'), nombre: 'Sin precio' },
  });
  assert.equal(parcial.status, 400);
});

test('[Validación] POST con precio no numérico devuelve 400', async () => {
  const res = await pedir('/api/productos', {
    method: 'POST',
    body: producto(codigoUnico('A'), { precio: 'caro' }),
  });
  assert.equal(res.status, 400);
});

test('[Validación] POST con código duplicado devuelve 409', async () => {
  const codigo = codigoUnico('A');
  await crear(codigo);
  const res = await pedir('/api/productos', { method: 'POST', body: producto(codigo) });
  assert.equal(res.status, 409);
});

test('[Validación] GET de código inexistente devuelve 404', async () => {
  const existente = codigoUnico('A');
  await crear(existente);
  const encontrado = await pedir(`/api/productos/${existente}`);
  assert.equal(encontrado.status, 200, 'la ruta GET /api/productos/:codigo debe existir');
  const res = await pedir(`/api/productos/${codigoUnico('NOEXISTE')}`);
  assert.equal(res.status, 404);
});

test('[Validación] PUT de código inexistente devuelve 404', async () => {
  const existente = codigoUnico('A');
  await crear(existente);
  const codigo = codigoUnico('NOEXISTE');
  const res = await pedir(`/api/productos/${codigo}`, {
    method: 'PUT',
    body: producto(codigo),
  });
  assert.equal(res.status, 404);
});

test('[Validación] DELETE de código inexistente devuelve 404', async () => {
  const existente = codigoUnico('A');
  await crear(existente);
  const res = await pedir(`/api/productos/${codigoUnico('NOEXISTE')}`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('[Persistencia] los datos sobreviven a un reinicio del servidor', async () => {
  const codigo = codigoUnico('A');
  await crear(codigo);
  await detenerServidor(proceso);
  proceso = iniciarServidor({ cwd: ALUMNO_DIR, puerto: PUERTO, dbPath });
  const listo = await esperarSalud(BASE);
  assert.ok(listo, 'el servidor no volvió a levantar tras el reinicio');
  const { status, datos } = await pedir(`/api/productos/${codigo}`);
  assert.equal(status, 200, 'el producto no persistió en SQLite');
  assert.equal(datos?.codigo, codigo);
});
