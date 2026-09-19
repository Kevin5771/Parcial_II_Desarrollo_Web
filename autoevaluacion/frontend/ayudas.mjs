export async function elegirOpcion(page, texto) {
  const boton = page.getByRole('button', { name: texto, exact: true }).first();
  const enlace = page.getByRole('link', { name: texto, exact: true }).first();

  if ((await boton.count()) > 0) {
    await boton.click();
  } else if ((await enlace.count()) > 0) {
    await enlace.click();
  } else {
    await page.getByText(texto, { exact: true }).first().click();
  }

  await page.waitForTimeout(250);
}

export async function contadorFilas(tabla) {
  const cuerpo = tabla.locator('tbody');
  const objetivo = (await cuerpo.count()) > 0 ? cuerpo.locator('tr') : tabla.locator('tr');
  return objetivo.count();
}

export async function leerContador(page, patron) {
  const texto = await page.locator('body').innerText();
  const coincidencia = texto.match(patron);
  return coincidencia ? Number(coincidencia[1]) : null;
}

export async function esperarContador(page, patron, timeout = 10000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    const numero = await leerContador(page, patron);
    if (numero !== null) return numero;
    await page.waitForTimeout(300);
  }
  return null;
}
