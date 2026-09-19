import { existsSync } from 'node:fs';

const RUTAS_COMUNES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

export async function detectarNavegador() {
  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    return null;
  }

  const forzado = process.env.AUTOEVAL_NAVEGADOR;
  const intentos = [];

  if (forzado) {
    const esRuta = forzado.includes('/') || forzado.includes('\\');
    intentos.push({ tipo: esRuta ? 'ruta' : 'canal', valor: forzado });
  } else {
    intentos.push({ tipo: 'chromium' });
    intentos.push({ tipo: 'canal', valor: 'chrome' });
    intentos.push({ tipo: 'canal', valor: 'msedge' });
    for (const ruta of RUTAS_COMUNES) {
      if (existsSync(ruta)) intentos.push({ tipo: 'ruta', valor: ruta });
    }
  }

  for (const intento of intentos) {
    try {
      const opciones = { timeout: 20000 };
      if (intento.tipo === 'canal') opciones.channel = intento.valor;
      if (intento.tipo === 'ruta') opciones.executablePath = intento.valor;

      const navegador = await chromium.launch(opciones);
      await navegador.close();
      return intento;
    } catch {}
  }

  return null;
}

export function variablesDeEntorno(navegador) {
  if (!navegador) return {};
  if (navegador.tipo === 'canal') return { PW_CANAL: navegador.valor };
  if (navegador.tipo === 'ruta') return { PW_EJECUTABLE: navegador.valor };
  return {};
}

export function instruccionesNavegador() {
  return [
    'No se encontró un navegador compatible para la Serie II (interfaz).',
    'Se usará automáticamente Chrome o Edge si están instalados; si no:',
    '  - instala Chromium una vez con internet: npx playwright install chromium',
    '  - o indica una ruta: AUTOEVAL_NAVEGADOR=/ruta/al/navegador npm run autoevaluacion',
  ].join('\n');
}
