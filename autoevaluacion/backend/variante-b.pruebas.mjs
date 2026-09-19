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
const PUERTO = Number(process.env.PUERTO ?? 3211);
const BASE = `http://127.0.0.1:${PUERTO}`;

let proceso;
let pedir;
let dbPath;

before(async () => {
  assert.ok(ALUMNO_DIR, 'Falta ALUMNO_DIR (carpeta del proyecto del alumno)');
  dbPath =
    process.env.DB_PATH ?? join(await mkdtemp(join(tmpdir(), 'calif-b-')), 'calificacion.db');

  proceso = iniciarServidor({ cwd: ALUMNO_DIR, puerto: PUERTO, dbPath });
  const listo = await esperarSalud(BASE);
  assert.ok(listo, `El servidor no respondió en ${BASE}/api/health (revise npm start)`);
  pedir = crearCliente(BASE);
});

after(async () => detenerServidor(proceso));

function materia(codigo, extra = {}) {
  return {
    codigo,
    nombre: 'Programación II',
    carrera: 'Ingeniería en Sistemas',
    creditos: 4,
    urlImagen: 'https://ejemplo.com/materia.png',
    ...extra,
  };
}

async function crear(codigo, extra) {
  const res = await pedir('/api/materias', { method: 'POST', body: materia(codigo, extra) });
  assert.equal(res.status, 201, `POST /api/materias devolvió ${res.status}`);
  return res.datos;
}

test('[API] GET /api/health responde ok', async () => {
  const { status, datos } = await pedir('/api/health');
  assert.equal(status, 200);
  assert.equal(datos?.ok, true);
});

test('[CRUD] POST crea una materia', async () => {
  const codigo = codigoUnico('B');
  const datos = await crear(codigo, { nombre: 'Bases de Datos' });
  assert.equal(datos?.codigo, codigo);
  assert.equal(datos?.nombre, 'Bases de Datos');
  assert.equal(Number(datos?.creditos), 4);
});

test('[CRUD] GET lista incluye la materia creada', async () => {
  const codigo = codigoUnico('B');
  await crear(codigo);
  const { status, datos } = await pedir('/api/materias');
  assert.equal(status, 200);
  assert.ok(Array.isArray(datos), 'GET /api/materias no devolvió un arreglo');
  assert.ok(datos.some((m) => m.codigo === codigo), 'la materia creada no aparece en la lista');
});

test('[CRUD] GET por código devuelve la materia', async () => {
  const codigo = codigoUnico('B');
  await crear(codigo, { nombre: 'Redes' });
  const { status, datos } = await pedir(`/api/materias/${codigo}`);
  assert.equal(status, 200);
  assert.equal(datos?.nombre, 'Redes');
});

test('[CRUD] PUT actualiza la materia', async () => {
  const codigo = codigoUnico('B');
  await crear(codigo);
  const res = await pedir(`/api/materias/${codigo}`, {
    method: 'PUT',
    body: materia(codigo, { nombre: 'Redes II', creditos: 5 }),
  });
  assert.equal(res.status, 200);
  const { datos } = await pedir(`/api/materias/${codigo}`);
  assert.equal(datos?.nombre, 'Redes II');
  assert.equal(Number(datos?.creditos), 5);
});

test('[CRUD] DELETE elimina la materia', async () => {
  const codigo = codigoUnico('B');
  await crear(codigo);
  const res = await pedir(`/api/materias/${codigo}`, { method: 'DELETE' });
  assert.ok([200, 204].includes(res.status), `DELETE devolvió ${res.status}`);
  const consulta = await pedir(`/api/materias/${codigo}`);
  assert.equal(consulta.status, 404);
});

test('[Validación] POST sin campos obligatorios devuelve 400', async () => {
  const vacio = await pedir('/api/materias', { method: 'POST', body: {} });
  assert.equal(vacio.status, 400);
  const parcial = await pedir('/api/materias', {
    method: 'POST',
    body: { codigo: codigoUnico('B'), nombre: 'Sin carrera' },
  });
  assert.equal(parcial.status, 400);
});

test('[Validación] POST con créditos no numéricos devuelve 400', async () => {
  const res = await pedir('/api/materias', {
    method: 'POST',
    body: materia(codigoUnico('B'), { creditos: 'muchos' }),
  });
  assert.equal(res.status, 400);
});

test('[Validación] POST con código duplicado devuelve 409', async () => {
  const codigo = codigoUnico('B');
  await crear(codigo);
  const res = await pedir('/api/materias', { method: 'POST', body: materia(codigo) });
  assert.equal(res.status, 409);
});

test('[Validación] GET de código inexistente devuelve 404', async () => {
  const existente = codigoUnico('B');
  await crear(existente);
  const encontrada = await pedir(`/api/materias/${existente}`);
  assert.equal(encontrada.status, 200, 'la ruta GET /api/materias/:codigo debe existir');
  const res = await pedir(`/api/materias/${codigoUnico('NOEXISTE')}`);
  assert.equal(res.status, 404);
});

test('[Validación] PUT de código inexistente devuelve 404', async () => {
  const existente = codigoUnico('B');
  await crear(existente);
  const codigo = codigoUnico('NOEXISTE');
  const res = await pedir(`/api/materias/${codigo}`, {
    method: 'PUT',
    body: materia(codigo),
  });
  assert.equal(res.status, 404);
});

test('[Validación] DELETE de código inexistente devuelve 404', async () => {
  const existente = codigoUnico('B');
  await crear(existente);
  const res = await pedir(`/api/materias/${codigoUnico('NOEXISTE')}`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('[Persistencia] los datos sobreviven a un reinicio del servidor', async () => {
  const codigo = codigoUnico('B');
  await crear(codigo);
  await detenerServidor(proceso);
  proceso = iniciarServidor({ cwd: ALUMNO_DIR, puerto: PUERTO, dbPath });
  const listo = await esperarSalud(BASE);
  assert.ok(listo, 'el servidor no volvió a levantar tras el reinicio');
  const { status, datos } = await pedir(`/api/materias/${codigo}`);
  assert.equal(status, 200, 'la materia no persistió en SQLite');
  assert.equal(datos?.codigo, codigo);
});
