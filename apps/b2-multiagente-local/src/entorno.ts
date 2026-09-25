import { cargarEntornoLocal } from '@unihelp/herramientas';

// Se ejecuta al importarse, antes que `AppModule`: la configuracion del agente
// se lee al construir los modulos y necesita las variables ya cargadas.
cargarEntornoLocal('apps/b2-multiagente-local/.env');
