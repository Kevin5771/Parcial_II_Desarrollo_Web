import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { abrirDb } from './db.js';

export function crearApp(db = abrirDb()) {
  const app = express();
  app.locals.db = db;
  app.use(cors());
  app.use(express.json());
  app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url))));
  const buscar = codigo => db.prepare('SELECT * FROM productos WHERE codigo = ?').get(codigo);
  function validar(body, codigo) {
    return body && typeof codigo === 'string' && codigo.trim() &&
      typeof body.nombre === 'string' && body.nombre.trim() &&
      typeof body.precio === 'number' && Number.isFinite(body.precio) && body.precio >= 0 &&
      typeof body.urlImagen === 'string' && body.urlImagen.trim();
  }
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/productos', (_req, res) => res.json(db.prepare('SELECT * FROM productos ORDER BY rowid').all()));
  app.get('/api/productos/:codigo', (req, res) => {
    const producto = buscar(req.params.codigo);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  });
  app.post('/api/productos', (req, res) => {
    if (!validar(req.body, req.body?.codigo)) return res.status(400).json({ error: 'Complete código, nombre, precio numérico no negativo e imagen' });
    const { nombre, precio, urlImagen } = req.body;
    const codigo = req.body.codigo.trim();
    if (buscar(codigo)) return res.status(409).json({ error: 'El código ya existe' });
    db.prepare('INSERT INTO productos VALUES (?, ?, ?, ?)').run(codigo, nombre.trim(), precio, urlImagen.trim());
    res.status(201).json(buscar(codigo));
  });
  app.put('/api/productos/:codigo', (req, res) => {
    const codigo = req.params.codigo;
    if (!buscar(codigo)) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!validar(req.body, codigo) || (req.body.codigo !== undefined && req.body.codigo !== codigo))
      return res.status(400).json({ error: 'Datos inválidos; el código no se puede cambiar' });
    const { nombre, precio, urlImagen } = req.body;
    db.prepare('UPDATE productos SET nombre = ?, precio = ?, urlImagen = ? WHERE codigo = ?').run(nombre.trim(), precio, urlImagen.trim(), codigo);
    res.json(buscar(codigo));
  });
  app.delete('/api/productos/:codigo', (req, res) => {
    const resultado = db.prepare('DELETE FROM productos WHERE codigo = ?').run(req.params.codigo);
    if (!resultado.changes) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto eliminado' });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use((error, _req, res, _next) => {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : 'Solicitud inválida' });
  });
  return app;
}
export const app = crearApp();
