import { app } from './app.js';

const puerto = Number(process.env.PORT ?? 3000);

app.listen(puerto, '127.0.0.1', () => {
  console.log(`API disponible en http://127.0.0.1:${puerto}`);
});
