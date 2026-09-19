import { test, expect } from '@playwright/test';
import { elegirOpcion, contadorFilas } from './ayudas.mjs';

test('Tabla: el formulario agrega una fila', async ({ page }) => {
  await page.goto('/');
  await elegirOpcion(page, 'Tabla');

  const tabla = page.locator('table').first();
  await expect(tabla).toBeVisible();

  const antes = await contadorFilas(tabla);
  const inputs = page.locator('form input:not([type]), form input[type="text"]');
  const total = await inputs.count();
  expect(total, 'el formulario debe tener al menos 3 campos de texto').toBeGreaterThanOrEqual(3);

  const marca = `Alumno${Date.now()}`;
  for (let i = 0; i < total; i += 1) {
    await inputs.nth(i).fill(`${marca}-${i}`);
  }

  await page.locator('form').getByRole('button', { name: /guardar/i }).first().click();

  await expect.poll(() => contadorFilas(tabla), { timeout: 8000 }).toBeGreaterThan(antes);
  await expect(tabla.getByText(`${marca}-0`)).toBeVisible();
});

test('Cards: 3 columnas, tarjetas de la API y arrastre', async ({ page, request }) => {
  const marca = `Card${Date.now()}`;
  for (let i = 0; i < 6; i += 1) {
    const res = await request.post('/api/productos', {
      data: {
        codigo: `${marca}-${i}`,
        nombre: `${marca}-${i}`,
        precio: i + 1,
        urlImagen: 'https://ejemplo.com/imagen.png',
      },
    });
    expect(res.status(), 'la API debe aceptar productos para la prueba de cards').toBe(201);
  }

  await page.goto('/');
  await elegirOpcion(page, 'Cards');

  const columnas = page.locator('.columna');
  await expect(columnas).toHaveCount(3);

  await expect
    .poll(
      async () => {
        const cantidades = [];
        for (let i = 0; i < 3; i += 1) {
          cantidades.push(await columnas.nth(i).locator('.tarjeta').count());
        }
        return Math.min(...cantidades);
      },
      { timeout: 10000 },
    )
    .toBeGreaterThanOrEqual(2);

  await expect(page.getByText(`${marca}-0`).first()).toBeVisible();

  const tarjeta = columnas.nth(0).locator('.tarjeta').first();
  await expect(tarjeta.locator('img').first()).toBeVisible();

  const antes0 = await columnas.nth(0).locator('.tarjeta').count();
  const antes2 = await columnas.nth(2).locator('.tarjeta').count();

  await tarjeta.dragTo(columnas.nth(2));

  await expect
    .poll(() => columnas.nth(0).locator('.tarjeta').count(), { timeout: 8000 })
    .toBe(antes0 - 1);
  await expect
    .poll(() => columnas.nth(2).locator('.tarjeta').count(), { timeout: 8000 })
    .toBe(antes2 + 1);
});

test('Carga dinámica: inyecta un script y cambia el fondo', async ({ page }) => {
  await page.goto('/');

  const scriptsAntes = await page.locator('script').count();
  const fondoAntes = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await elegirOpcion(page, 'Carga dinámica');

  await expect
    .poll(() => page.locator('script').count(), { timeout: 8000 })
    .toBeGreaterThan(scriptsAntes);

  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor), {
      timeout: 13000,
      intervals: [500],
    })
    .not.toBe(fondoAntes);
});

test('Productos en vivo: muestra los productos de la API', async ({ page, request }) => {
  const marca = `Vivo${Date.now()}`;
  const res = await request.post('/api/productos', {
    data: {
      codigo: marca,
      nombre: marca,
      precio: 3.5,
      urlImagen: 'https://ejemplo.com/vivo.png',
    },
  });
  expect(res.status()).toBe(201);

  await page.goto('/');
  await elegirOpcion(page, 'Productos en vivo');

  await expect(page.getByText(marca, { exact: false }).first()).toBeVisible({ timeout: 10000 });
});
