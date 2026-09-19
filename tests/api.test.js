import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const carpeta = mkdtempSync(join(tmpdir(), 'productos-test-'));
process.env.DB_PATH = join(carpeta, 'pruebas.db');
const { app } = await import('../src/app.js');
let servidor, base;
before(async () => {
  servidor = app.listen(0, '127.0.0.1');
  await new Promise(resolve => servidor.on('listening', resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(async () => {
  await new Promise(resolve => servidor.close(resolve));
  app.locals.db.close();
  rmSync(carpeta, { recursive: true, force: true });
});
const producto = { codigo: 'TEST-1', nombre: 'Producto de prueba', precio: 25.5, urlImagen: '/producto.svg' };
async function pedir(ruta, method = 'GET', body) {
  return fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}
test('Salud de la API', async () => {
  const res = await pedir('/api/health'); assert.equal(res.status, 200); assert.deepEqual(await res.json(), { ok: true });
});
test('CRUD completo: crear, listar, consultar, actualizar y eliminar', async () => {
  let res = await pedir('/api/productos', 'POST', producto); assert.equal(res.status, 201); assert.deepEqual(await res.json(), producto);
  res = await pedir('/api/productos'); assert.ok((await res.json()).some(p => p.codigo === producto.codigo));
  res = await pedir('/api/productos/TEST-1'); assert.deepEqual(await res.json(), producto);
  res = await pedir('/api/productos/TEST-1', 'PUT', { ...producto, nombre: 'Actualizado', precio: 0 }); assert.equal(res.status, 200); assert.equal((await res.json()).precio, 0);
  res = await pedir('/api/productos/TEST-1'); assert.equal((await res.json()).nombre, 'Actualizado');
  res = await pedir('/api/productos/TEST-1', 'DELETE'); assert.equal(res.status, 200);
  res = await pedir('/api/productos/TEST-1'); assert.equal(res.status, 404);
});
test('Rechaza campos faltantes, vacíos y precios inválidos', async () => {
  for (const body of [{}, null, { ...producto, nombre: ' ' }, { ...producto, precio: '25' }, { ...producto, precio: -1 }, { ...producto, urlImagen: '' }]) {
    assert.equal((await pedir('/api/productos', 'POST', body)).status, 400);
  }
});
test('Código duplicado y actualización inválida conservan los datos', async () => {
  await pedir('/api/productos', 'POST', producto);
  assert.equal((await pedir('/api/productos', 'POST', producto)).status, 409);
  assert.equal((await pedir('/api/productos/TEST-1', 'PUT', { ...producto, precio: -2 })).status, 400);
  assert.equal((await pedir('/api/productos/TEST-1', 'PUT', { ...producto, codigo: 'OTRO' })).status, 400);
  assert.deepEqual(await (await pedir('/api/productos/TEST-1')).json(), producto);
});
test('Recursos inexistentes devuelven 404', async () => {
  for (const metodo of ['GET', 'PUT', 'DELETE']) assert.equal((await pedir('/api/productos/NO-EXISTE', metodo, metodo === 'PUT' ? producto : undefined)).status, 404);
});
test('JSON mal formado devuelve error JSON con estado 400', async () => {
  const res = await fetch(base + '/api/productos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalido' });
  assert.equal(res.status, 400); assert.ok((await res.json()).error);
});
test('SQLite conserva datos al volver a abrir la conexión', async () => {
  const { abrirDb } = await import('../src/db.js');
  const db = abrirDb(process.env.DB_PATH);
  assert.equal(db.prepare('SELECT nombre FROM productos WHERE codigo = ?').get('TEST-1').nombre, producto.nombre);
  db.close();
});
