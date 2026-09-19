const MINIMO = [22, 13, 0];

function compararVersion(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

const actual = process.versions.node.split('.').map(Number);
const fallos = [];

if (compararVersion(actual, MINIMO) < 0) {
  fallos.push(
    `Node ${process.versions.node} es antiguo. Se requiere Node ${MINIMO.join('.')} o superior (recomendado Node 24 LTS).`,
  );
}

for (const modulo of ['node:sqlite', 'express', 'cors']) {
  try {
    await import(modulo);
  } catch {
    fallos.push(`No se pudo cargar el modulo "${modulo}".`);
  }
}

if (fallos.length > 0) {
  console.error('\nRevision de requisitos: FALLO\n');
  for (const fallo of fallos) console.error(`  - ${fallo}`);
  console.error('\nActualiza Node desde https://nodejs.org (version LTS) antes del examen.\n');
  process.exit(1);
}

console.log(
  `\nRevision de requisitos: OK (Node ${process.versions.node}, node:sqlite, express, cors)\n`,
);
