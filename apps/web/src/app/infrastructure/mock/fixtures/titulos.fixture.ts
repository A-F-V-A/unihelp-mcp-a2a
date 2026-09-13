/** Titulo con el que se guarda una conversacion que empieza por cada escenario. */
export const TITULOS_POR_ESCENARIO: Readonly<Record<string, string>> = {
  'informativa-matricula': 'Ajustes de matrícula',
  'informativa-reembolso': 'Reembolso de un pago',
  'informativa-cuenta': 'Acceso a la cuenta institucional',
  'diagnostico-plataforma': 'Falla del aula virtual',
  'diagnostico-correo': 'Correo institucional sin envío',
  'diagnostico-red': 'Sin conexión en el campus',
  'mantenimiento-biblioteca': 'Servicios en línea de la biblioteca',
  'compuesta-pago-matricula': 'Pago de matrícula por PSE',
  'fuera-alcance-parqueadero': 'Parqueadero del campus',
  'fuera-alcance-restaurante': 'Restaurante universitario',
  'fuera-alcance-general': 'Consulta fuera de alcance',
  'confirmacion-por-texto': 'Creación de un ticket',
};
