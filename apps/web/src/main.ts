import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { crearAppConfig } from './app/app.config';
import { cargarConfiguracion } from './app/nucleo/configuracion';

// Se resuelve la configuracion de entorno ANTES de arrancar Angular: la misma
// imagen de `web` sirve para B0, B1, B2 y B3.
cargarConfiguracion()
  .then((configuracion) => bootstrapApplication(App, crearAppConfig(configuracion)))
  .catch((error: unknown) => console.error('No se pudo arrancar UniHelp web', error));
