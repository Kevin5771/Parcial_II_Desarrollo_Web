const contenido = document.querySelector('#contenido');
const alumnos = [];
let versionVista = 0;
let intervaloVivo;
let arrastrada;

async function pedirProductos() {
  const respuesta = await fetch('/api/productos', { cache: 'no-store' });
  if (!respuesta.ok) throw new Error('No se pudieron cargar los productos.');
  return respuesta.json();
}
function texto(tag, valor) {
  const elemento = document.createElement(tag);
  elemento.textContent = valor;
  return elemento;
}
function mensaje(error) {
  const nodo = contenido.querySelector('.mensaje');
  if (nodo) { nodo.textContent = error.message; nodo.classList.add('error'); }
}
function dibujarAlumnos() {
  const cuerpo = contenido.querySelector('tbody');
  cuerpo.replaceChildren();
  alumnos.forEach(alumno => {
    const fila = document.createElement('tr');
    alumno.forEach(valor => fila.append(texto('td', valor)));
    cuerpo.append(fila);
  });
}
function tabla() {
  contenido.innerHTML = `<h2>Registro de alumnos</h2><p>Completa los datos para agregar un alumno a la tabla.</p>
    <form id="alumnos"><label>Carné<input type="text" name="carne" required></label><label>Nombre<input type="text" name="nombre" required></label><label>Carrera<input type="text" name="carrera" required></label><button>Guardar</button></form>
    <div class="tabla-scroll"><table><thead><tr><th>Carné</th><th>Nombre</th><th>Carrera</th></tr></thead><tbody></tbody></table></div>`;
  dibujarAlumnos();
  contenido.querySelector('form').addEventListener('submit', evento => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const fila = ['carne', 'nombre', 'carrera'].map(campo => datos.get(campo).trim());
    if (fila.some(valor => !valor)) return;
    alumnos.push(fila); dibujarAlumnos(); evento.currentTarget.reset();
  });
}
async function cards(version) {
  contenido.innerHTML = `<h2>Tarjetas de productos</h2><p>Arrastra los productos entre las columnas o usa el selector de cada tarjeta.</p><p class="mensaje" role="status">Cargando productos…</p><div class="columnas"><section class="columna"><h3>Columna 1</h3></section><section class="columna"><h3>Columna 2</h3></section><section class="columna"><h3>Columna 3</h3></section></div>`;
  try {
    const productos = await pedirProductos();
    if (version !== versionVista) return;
    const columnas = [...contenido.querySelectorAll('.columna')];
    columnas.forEach((columna, i) => {
      columna.addEventListener('dragover', evento => evento.preventDefault());
      columna.addEventListener('drop', evento => {
        evento.preventDefault();
        if (arrastrada) { columna.append(arrastrada); arrastrada.querySelector('select').value = String(i); }
      });
    });
    productos.forEach((producto, i) => {
      const tarjeta = document.createElement('article');
      tarjeta.className = 'tarjeta'; tarjeta.draggable = true;
      const imagen = document.createElement('img');
      imagen.alt = producto.nombre;
      imagen.src = /^(https?:\/\/|\/(?!\/))/.test(producto.urlImagen) ? producto.urlImagen : '/producto.svg';
      imagen.addEventListener('error', () => { imagen.src = '/producto.svg'; }, { once: true });
      tarjeta.append(texto('h4', producto.nombre), imagen, texto('p', `Código: ${producto.codigo} · Precio: Q${producto.precio.toFixed(2)}`));
      const selector = document.createElement('select');
      selector.setAttribute('aria-label', `Mover ${producto.nombre}`);
      columnas.forEach((_, numero) => { const opcion = texto('option', `Columna ${numero + 1}`); opcion.value = numero; selector.append(opcion); });
      selector.value = String(i % 3);
      selector.addEventListener('change', () => columnas[Number(selector.value)].append(tarjeta));
      tarjeta.append(selector);
      tarjeta.addEventListener('dragstart', evento => { arrastrada = tarjeta; evento.dataTransfer.setData('text/plain', producto.codigo); });
      tarjeta.addEventListener('dragend', () => { arrastrada = null; });
      columnas[i % 3].append(tarjeta);
    });
    contenido.querySelector('.mensaje').textContent = productos.length ? `${productos.length} productos cargados desde la API.` : 'No hay productos registrados.';
  } catch (error) { if (version === versionVista) mensaje(error); }
}
function dinamica() {
  contenido.innerHTML = '<h2>Carga dinámica</h2><p>El fondo cambiará a un color aleatorio cada 5 segundos.</p>';
  const script = document.createElement('script');
  script.id = 'script-colores'; script.src = 'colores.js'; script.async = false;
  contenido.append(script);
}
function vivo(version) {
  contenido.innerHTML = `<h2>Productos en vivo</h2><p>El listado se actualiza cada 3 segundos.</p><form id="producto"><label>Código<input name="codigo" required></label><label>Nombre<input name="nombre" required></label><label>Precio (Q)<input name="precio" type="number" min="0" step="0.01" required></label><label>Imagen (URL o ruta)<input name="urlImagen" value="/producto.svg" required></label><button>Guardar producto</button></form><p class="mensaje" role="status"></p><ul class="lista-productos"></ul>`;
  let pendiente = false;
  async function actualizar() {
    if (pendiente) return;
    pendiente = true;
    try {
      const productos = await pedirProductos();
      if (version !== versionVista) return;
      const lista = contenido.querySelector('ul'); lista.replaceChildren();
      productos.forEach(producto => lista.append(texto('li', `${producto.nombre} — ${producto.codigo} — Q${producto.precio.toFixed(2)}`)));
      if (!productos.length) lista.append(texto('li', 'No hay productos registrados.'));
    } catch (error) { if (version === versionVista) mensaje(error); }
    finally { pendiente = false; }
  }
  contenido.querySelector('form').addEventListener('submit', async evento => {
    evento.preventDefault();
    const form = evento.currentTarget;
    const datos = Object.fromEntries(new FormData(form)); datos.precio = Number(datos.precio);
    const boton = form.querySelector('button'); boton.disabled = true;
    try {
      const respuesta = await fetch('/api/productos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error);
      if (version !== versionVista) return;
      form.reset(); const aviso = contenido.querySelector('.mensaje'); aviso.classList.remove('error'); aviso.textContent = 'Producto guardado.'; await actualizar();
    } catch (error) { if (version === versionVista) mensaje(error); }
    finally { boton.disabled = false; }
  });
  actualizar(); intervaloVivo = setInterval(actualizar, 3000);
}
function mostrar(vista) {
  const version = ++versionVista;
  clearInterval(intervaloVivo); clearInterval(window.intervaloColores);
  document.querySelector('#script-colores')?.remove();
  document.body.style.backgroundColor = '';
  document.querySelectorAll('[data-vista]').forEach(boton => { boton.classList.toggle('activo', boton.dataset.vista === vista); boton.setAttribute('aria-pressed', String(boton.dataset.vista === vista)); });
  if (vista === 'tabla') tabla();
  if (vista === 'cards') cards(version);
  if (vista === 'dinamica') dinamica();
  if (vista === 'vivo') vivo(version);
}
document.querySelectorAll('[data-vista]').forEach(boton => boton.addEventListener('click', () => mostrar(boton.dataset.vista)));
mostrar('tabla');
