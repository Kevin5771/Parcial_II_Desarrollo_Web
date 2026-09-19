import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function abrirDb(ruta = process.env.DB_PATH ?? 'data/parcial.db') {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(`CREATE TABLE IF NOT EXISTS productos (
    codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL,
    precio REAL NOT NULL CHECK(precio >= 0), urlImagen TEXT NOT NULL
  ); CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY);`);
  // Los ejemplos se crean una sola vez; los productos eliminados no reaparecen.
  if (!db.prepare("SELECT clave FROM configuracion WHERE clave = 'ejemplos'").get()) {
    const insertar = db.prepare('INSERT OR IGNORE INTO productos VALUES (?, ?, ?, ?)');
    db.exec('BEGIN');
    try {
      ['Mouse', 'Teclado', 'Monitor', 'Audífonos', 'Memoria USB', 'Cámara web'].forEach((nombre, i) => {
        insertar.run(`P00${i + 1}`, nombre, [75, 150, 1200, 180, 65, 250][i], '/producto.svg');
      });
      db.prepare('INSERT INTO configuracion VALUES (?)').run('ejemplos');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return db;
}
