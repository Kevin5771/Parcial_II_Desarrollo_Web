import { test, expect } from '@playwright/test';
import { elegirOpcion, esperarContador, leerContador } from './ayudas.mjs';

const PATRON_RELOJ = /Has presionado el bot[oó]n Reloj desde hace\s*(\d+)\s*segundos/i;

async function crearMateria(request, codigo, extra = {}) {
  const res = await request.post('/api/materias', {
    data: {
      codigo,
      nombre: codigo,
      carrera: 'Ingeniería en Sistemas',
      creditos: 4,
      urlImagen: 'https://ejemplo.com/materia.png',
      ...extra,
    },
  });
  expect(res.status(), 'la API debe aceptar materias para la prueba').toBe(201);
}

test('Tabla: muestra las materias de la API', async ({ page, request }) => {
  const marca = `Mat${Date.now()}`;
  await crearMateria(request, marca);

  await page.goto('/');
  await elegirOpcion(page, 'Tabla');

  const tabla = page.locator('table').first();
  await expect(tabla).toBeVisible();
  await expect(tabla.getByText(marca, { exact: false }).first()).toBeVisible({ timeout: 10000 });
});

test('Tabla: las cabeceras se pueden reordenar arrastrando', async ({ page, request }) => {
  const marca = `Mat${Date.now()}`;
  await crearMateria(request, marca);

  await page.goto('/');
  await elegirOpcion(page, 'Tabla');

  const cabeceras = page.locator('table th');
  expect(await cabeceras.count()).toBeGreaterThanOrEqual(2);

  const ordenAntes = (await cabeceras.allTextContents()).join('|');
  await cabeceras.nth(0).dragTo(cabeceras.nth(1));

  await expect
    .poll(async () => (await cabeceras.allTextContents()).join('|'), { timeout: 8000 })
    .not.toBe(ordenAntes);
});

test('Nueva materia: envía el POST y agrega la fila', async ({ page, request }) => {
  const marca = `NMat${Date.now()}`;

  await page.goto('/');
  await elegirOpcion(page, 'Tabla');
  await page.getByRole('button', { name: /nueva materia/i }).first().click();

  await page.locator('[name="nombre"]').fill(marca);
  await page.locator('[name="carrera"]').fill('Ingeniería en Sistemas');
  await page.locator('[name="codigo"]').fill(marca);
  await page.locator('[name="creditos"]').fill('5');

  const url = page.locator('[name="urlImagen"]');
  if ((await url.count()) > 0) {
    await url.fill('https://ejemplo.com/nueva.png');
  }

  await page.locator('form').getByRole('button', { name: /guardar/i }).first().click();

  await expect(page.getByText(marca, { exact: false }).first()).toBeVisible({ timeout: 10000 });

  const res = await request.get(`/api/materias/${marca}`);
  expect(res.status(), 'la materia debe quedar guardada en la API').toBe(200);
});

test('Formulario: conserva lo escrito en localStorage al recargar', async ({ page }) => {
  const marca = `Draft${Date.now()}`;

  await page.goto('/');
  await elegirOpcion(page, 'Tabla');
  await page.getByRole('button', { name: /nueva materia/i }).first().click();

  await page.locator('[name="nombre"]').fill(marca);
  await page.locator('[name="carrera"]').fill(`${marca}-carrera`);

  await page.reload();
  await elegirOpcion(page, 'Tabla');

  const nombre = page.locator('[name="nombre"]');
  const visible = await nombre
    .first()
    .isVisible()
    .catch(() => false);
  if (!visible) {
    await page.getByRole('button', { name: /nueva materia/i }).first().click();
  }

  await expect(page.locator('[name="nombre"]')).toHaveValue(marca, { timeout: 10000 });
});

test('Reloj: el contador aumenta cada segundo', async ({ page }) => {
  await page.goto('/');
  await elegirOpcion(page, 'Reloj');

  let numero = await esperarContador(page, PATRON_RELOJ, 3000);

  if (numero === null) {
    await page.getByRole('button', { name: /reloj|presionar|iniciar/i }).first().click();
    numero = await esperarContador(page, PATRON_RELOJ);
  }

  expect(numero, 'debe aparecer el texto "Has presionado el botón Reloj desde hace XX segundos"').not.toBeNull();

  await page.waitForTimeout(2500);
  const siguiente = await leerContador(page, PATRON_RELOJ);
  expect(siguiente).not.toBeNull();
  expect(siguiente).toBeGreaterThan(numero);
});
