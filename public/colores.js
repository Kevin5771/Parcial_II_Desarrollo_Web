(() => {
  if (!document.querySelector('#script-colores')) return;
  clearInterval(window.intervaloColores);
  window.intervaloColores = setInterval(() => {
  if (!document.querySelector('#script-colores')) return;
    const color = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    document.body.style.backgroundColor = `#${color}`;
  }, 5000);
})();
