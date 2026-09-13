import type { EscenarioConversacion } from './tipos';

/**
 * Casos de conversacion del backend simulado. Cubren las cuatro
 * clasificaciones y todos los tipos de bloque que la UI sabe mostrar.
 *
 * | escenario                   | clasificacion    | que ejercita                              |
 * | --------------------------- | ---------------- | ----------------------------------------- |
 * | informativa-matricula       | informativa      | politicas citadas                         |
 * | informativa-reembolso       | informativa      | una sola politica                         |
 * | informativa-cuenta          | informativa      | 4 politicas -> la UI debe mostrar solo 3  |
 * | diagnostico-plataforma      | diagnostico      | servicio degradado con ventana + ticket   |
 * | diagnostico-correo          | diagnostico      | servicio interrumpido SIN ventana + ticket|
 * | diagnostico-red             | diagnostico      | servicio operativo (problema local)       |
 * | mantenimiento-biblioteca    | diagnostico      | mantenimiento programado, sin ticket      |
 * | compuesta-pago-matricula    | compuesta        | estado + politicas + ticket               |
 * | fuera-alcance-*             | fuera-de-alcance | aviso con canal correcto                  |
 * | confirmacion-por-texto      | informativa      | el texto NUNCA crea un ticket             |
 */
export const ESCENARIOS: readonly EscenarioConversacion[] = [
  {
    id: 'informativa-matricula',
    tema: 'los ajustes de matrícula',
    palabrasClave: [
      'matricula',
      'adicionar',
      'adicion',
      'cancelar',
      'cancelacion',
      'asignatura',
      'asignaturas',
      'materia',
      'materias',
      'calendario',
    ],
    clasificacion: { tipo: 'informativa', confianza: 0.93 },
    bloques: [
      {
        tipo: 'texto',
        texto:
          'Puedes adicionar o cancelar asignaturas desde el portal estudiantil hasta la tercera semana del periodo. Pasada esa fecha, la cancelación se solicita ante el comité curricular, a más tardar en la semana ocho.',
      },
      { tipo: 'politicas', codigos: ['PA-REG-012', 'PA-ACA-021'] },
    ],
    propuesta: null,
    fijaContexto: true,
  },
  {
    id: 'informativa-reembolso',
    tema: 'tu reembolso',
    palabrasClave: [
      'reembolso',
      'devolucion',
      'devuelvan',
      'reintegro',
      'saldo a favor',
      'doble cobro',
      'pague dos veces',
      'cobraron dos veces',
    ],
    clasificacion: { tipo: 'informativa', confianza: 0.9 },
    bloques: [
      {
        tipo: 'texto',
        texto:
          'Si pagaste dos veces o pagaste un concepto que no correspondía, tienes derecho a reembolso. Radica la solicitud en la División Financiera con el soporte de pago y tu certificación bancaria; el plazo máximo es de 30 días hábiles.',
      },
      { tipo: 'politicas', codigos: ['PA-FIN-004'] },
    ],
    propuesta: null,
    fijaContexto: true,
  },
  {
    id: 'informativa-cuenta',
    tema: 'el acceso a tu cuenta institucional',
    palabrasClave: [
      'contrasena',
      'clave',
      'olvide',
      'recuperar',
      'bloqueada',
      'bloqueo',
      'doble factor',
      'autenticacion',
      'segundo factor',
    ],
    clasificacion: { tipo: 'informativa', confianza: 0.88 },
    bloques: [
      {
        tipo: 'texto',
        texto:
          'Puedes restablecer tu contraseña en línea con tu correo alterno registrado. Si tu cuenta se bloqueó por intentos fallidos, espera 15 minutos antes de volver a intentarlo. Recuerda que nadie de la universidad te pedirá tu contraseña.',
      },
      // Cuatro codigos a proposito: la regla de dominio debe dejar solo tres.
      { tipo: 'politicas', codigos: ['PA-TIC-007', 'PA-TIC-011', 'PA-TIC-015', 'PA-TIC-003'] },
    ],
    propuesta: null,
    fijaContexto: true,
  },
  {
    id: 'diagnostico-plataforma',
    tema: 'la falla del aula virtual',
    palabrasClave: [
      'plataforma',
      'moodle',
      'aula virtual',
      'campus virtual',
      'tarea',
      'tareas',
      'entregar',
      'entrega',
      'no carga',
    ],
    clasificacion: { tipo: 'diagnostico', confianza: 0.91 },
    bloques: [
      {
        tipo: 'texto',
        texto:
          'Revisé el estado del aula virtual: hay un incidente activo en el módulo de entrega de tareas que coincide con lo que describes. No es un problema de tu equipo.',
      },
      { tipo: 'estado-servicio', servicio: 'plataforma-virtual' },
    ],
    propuesta: {
      servicio: 'plataforma-virtual',
      categoria: 'Falla en entrega de actividades',
      prioridad: 'alta',
      resumen: 'No es posible entregar tareas en el aula virtual',
      estadoInicialTicket: 'asignado',
      atencionEstimada: '4 horas hábiles',
    },
    fijaContexto: true,
  },
  {
    id: 'diagnostico-correo',
    tema: 'el correo institucional',
    palabrasClave: [
      'correo',
      'correos',
      'outlook',
      'email',
      'bandeja',
      'no me llegan',
      'enviar mensajes',
    ],
    clasificacion: { tipo: 'diagnostico', confianza: 0.87 },
    bloques: [
      {
        tipo: 'texto',
        texto:
          'El correo institucional tiene una interrupción en el envío de mensajes. El equipo de sistemas ya está trabajando, pero todavía no hay una estimación de cuándo se restablece.',
      },
      { tipo: 'estado-servicio', servicio: 'soporte-tecnico' },
    ],
    propuesta: {
      servicio: 'soporte-tecnico',
      categoria: 'Correo institucional',
      prioridad: 'critica',
      resumen: 'El correo institucional no permite enviar mensajes',
      estadoInicialTicket: 'en-triaje',
      atencionEstimada: '2 horas',
    },
    fijaContexto: true,
  },
  {
    id: 'diagnostico-red',
    tema: 'tu conexión a la red del campus',
    palabrasClave: [
      'wifi',
      'wi-fi',
      'internet',
      'red inalambrica',
      'sin conexion',
      'conectarme',
      'conecta',
      'se desconecta',
    ],
    clasificacion: { tipo: 'diagnostico', confianza: 0.78 },
    bloques: [
      {
        tipo: 'texto',
        texto:
          'No hay incidentes reportados en la red inalámbrica del campus, así que el problema parece local a tu equipo o a tu zona.',
      },
      { tipo: 'estado-servicio', servicio: 'infraestructura-fisica' },
      {
        tipo: 'texto',
        texto:
          'Prueba olvidar la red y volver a conectarte con tu usuario institucional. Si el problema persiste, puedo registrar un ticket para que lo revisen en sitio.',
      },
    ],
    propuesta: {
      servicio: 'infraestructura-fisica',
      categoria: 'Conectividad en el campus',
      prioridad: 'media',
      resumen: 'Sin conexión a la red inalámbrica del campus',
      estadoInicialTicket: 'recibido',
      atencionEstimada: '1 día hábil',
    },
    fijaContexto: true,
  },
  {
    id: 'mantenimiento-biblioteca',
    tema: 'los servicios en línea de la biblioteca',
    palabrasClave: [
      'biblioteca',
      'catalogo',
      'prestamo',
      'prestamos',
      'renovar',
      'renovacion',
      'reserva',
      'libro',
      'libros',
    ],
    clasificacion: { tipo: 'diagnostico', confianza: 0.9 },
    bloques: [
      { tipo: 'aviso-mantenimiento', servicio: 'biblioteca' },
      {
        tipo: 'texto',
        texto:
          'Es un mantenimiento programado, no una falla, así que no hace falta crear un ticket. Los préstamos que venzan durante la ventana se extienden automáticamente sin multa.',
      },
      { tipo: 'politicas', codigos: ['PA-BIB-003'] },
    ],
    propuesta: null,
    fijaContexto: true,
  },
  {
    id: 'compuesta-pago-matricula',
    tema: 'el pago de tu matrícula',
    palabrasClave: [
      'pago',
      'pagar',
      'pse',
      'recibo',
      'liquidacion',
      'vence',
      'plazo',
      'matricula',
      'fecha limite',
    ],
    clasificacion: { tipo: 'compuesta', confianza: 0.86 },
    bloques: [
      {
        tipo: 'texto',
        texto:
          'Tu solicitud tiene dos partes: una falla técnica al pagar y una duda sobre el plazo. Sobre la falla, la pasarela PSE tiene un incidente activo:',
      },
      { tipo: 'estado-servicio', servicio: 'financiera' },
      {
        tipo: 'texto',
        texto:
          'Sobre el plazo: como la falla está registrada, tu fecha de pago se amplía automáticamente dos días hábiles después de restablecido el servicio, sin recargo.',
      },
      { tipo: 'politicas', codigos: ['PA-FIN-009', 'PA-REG-012'] },
    ],
    propuesta: {
      servicio: 'financiera',
      categoria: 'Pagos en línea',
      prioridad: 'alta',
      resumen: 'No es posible pagar la matrícula por PSE',
      estadoInicialTicket: 'recibido',
      atencionEstimada: '8 horas hábiles',
    },
    fijaContexto: true,
  },
  {
    id: 'fuera-alcance-parqueadero',
    tema: 'el parqueadero',
    palabrasClave: [
      'parqueadero',
      'parquear',
      'estacionar',
      'estacionamiento',
      'carro',
      'moto',
      'vehiculo',
    ],
    clasificacion: { tipo: 'fuera-de-alcance', confianza: 0.95 },
    bloques: [
      {
        tipo: 'fuera-de-alcance',
        motivo:
          'UniHelp atiende incidentes de servicios académicos y tecnológicos. Los parqueaderos y el ingreso de vehículos los gestiona otra dependencia.',
        canal: 'seguridad-campus',
      },
    ],
    propuesta: null,
    fijaContexto: false,
  },
  {
    id: 'fuera-alcance-restaurante',
    tema: 'el restaurante universitario',
    palabrasClave: ['restaurante', 'almuerzo', 'menu', 'cafeteria', 'comida'],
    clasificacion: { tipo: 'fuera-de-alcance', confianza: 0.92 },
    bloques: [
      {
        tipo: 'fuera-de-alcance',
        motivo:
          'El servicio de alimentación no hace parte del soporte que atiende UniHelp; lo administra directamente Bienestar Universitario.',
        canal: 'restaurante-universitario',
      },
    ],
    propuesta: null,
    fijaContexto: false,
  },
  {
    id: 'fuera-alcance-general',
    tema: 'tu consulta',
    palabrasClave: [
      'clima',
      'receta',
      'futbol',
      'partido',
      'pelicula',
      'chiste',
      'horoscopo',
      'noticias',
    ],
    clasificacion: { tipo: 'fuera-de-alcance', confianza: 0.97 },
    bloques: [
      {
        tipo: 'fuera-de-alcance',
        motivo:
          'Tu consulta no está relacionada con los servicios universitarios que atiende UniHelp.',
        canal: 'atencion-general',
      },
    ],
    propuesta: null,
    fijaContexto: false,
  },
  {
    id: 'confirmacion-por-texto',
    tema: 'la creación del ticket',
    palabrasClave: [
      'confirmo',
      'crealo',
      'crea el ticket',
      'crear el ticket',
      'abre el ticket',
      'acepto la propuesta',
    ],
    clasificacion: { tipo: 'informativa', confianza: 0.6 },
    bloques: [
      {
        tipo: 'texto',
        texto:
          'Para crear un ticket necesito que lo confirmes con el botón «Confirmar» de la propuesta. Por seguridad, nunca creo tickets a partir de lo que escribes en el chat.',
      },
    ],
    propuesta: null,
    fijaContexto: false,
  },
];

/** Respuesta cuando no hay coincidencias pero la conversacion ya tiene un tema. `{tema}` se reemplaza. */
export const PLANTILLA_SEGUIMIENTO =
  'Gracias por el detalle, lo sumo a lo que me contaste sobre {tema}. Con esa información el diagnóstico no cambia; si notas algo distinto, cuéntame qué ves ahora.';

/** Respuesta cuando no hay coincidencias ni contexto previo. */
export const TEXTO_SIN_COINCIDENCIA =
  'Todavía no tengo claro qué necesitas. ¿Me dices qué servicio estabas usando (aula virtual, correo, pagos, biblioteca, matrícula...) y qué ocurrió exactamente?';

/** Se agrega a la respuesta del ultimo turno disponible. */
export const TEXTO_ULTIMO_TURNO =
  'Este fue el último turno disponible en esta conversación. Si necesitas algo más, inicia una conversación nueva.';
