import { cargarEntornoLocal } from '@unihelp/herramientas';

// Se ejecuta al importarse, antes que `AppModule`: la conexion a PostgreSQL y el
// limite de llamadas se leen al construir los modulos.
cargarEntornoLocal('apps/mcp-server/.env');
