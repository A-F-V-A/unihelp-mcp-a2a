import type { PoliticaDto } from '@unihelp/contratos';

const ENLACE_BASE = 'https://normativa.unihelp.example/politicas';

export const POLITICAS: readonly PoliticaDto[] = [
  {
    codigo: 'PA-REG-012',
    version: '3.1',
    titulo: 'Calendario académico y ajustes de matrícula',
    extracto:
      'Las adiciones y cancelaciones de asignaturas se realizan en el portal estudiantil hasta la tercera semana del periodo académico.',
    area: 'registro-academico',
    contenido: [
      '1. El calendario académico fija para cada periodo una ventana de ajustes de matrícula de tres semanas contadas desde el inicio de clases.',
      '2. Dentro de esa ventana el estudiante puede adicionar o cancelar asignaturas desde el portal estudiantil sin trámite adicional.',
      '3. Vencida la ventana, la cancelación de asignaturas se rige por la política PA-ACA-021.',
      '4. Cuando un canal institucional falle durante la ventana, la Secretaría Académica podrá extenderla mediante comunicado oficial.',
    ],
    vigenteDesde: '2026-01-15T00:00:00.000Z',
    dependenciaResponsable: 'Secretaría Académica',
    enlace: `${ENLACE_BASE}/PA-REG-012`,
  },
  {
    codigo: 'PA-ACA-021',
    version: '2.0',
    titulo: 'Cancelación de asignaturas y del periodo académico',
    extracto:
      'Después de la ventana de ajustes, la cancelación de una asignatura requiere solicitud ante el comité curricular antes de la semana ocho.',
    area: 'registro-academico',
    contenido: [
      '1. La cancelación extemporánea de asignaturas se solicita ante el comité curricular del programa, a más tardar en la semana ocho del periodo.',
      '2. La cancelación del periodo completo puede solicitarse hasta la semana doce, por causas debidamente justificadas.',
      '3. Las asignaturas canceladas no afectan el promedio, pero sí cuentan para el cálculo de permanencia.',
    ],
    vigenteDesde: '2025-07-01T00:00:00.000Z',
    dependenciaResponsable: 'Vicerrectoría Académica',
    enlace: `${ENLACE_BASE}/PA-ACA-021`,
  },
  {
    codigo: 'PA-FIN-004',
    version: '2.3',
    titulo: 'Devoluciones y reembolsos de pagos',
    extracto:
      'Los pagos duplicados o no causados se reembolsan en un plazo máximo de 30 días hábiles tras radicar la solicitud con el soporte de pago.',
    area: 'financiera',
    contenido: [
      '1. Procede el reembolso por pago duplicado, pago de un concepto no causado o cancelación del periodo antes de iniciar clases.',
      '2. La solicitud se radica en la Division Financiera adjuntando el soporte de pago y la certificación bancaria del titular.',
      '3. El reembolso se efectúa en un plazo máximo de 30 días hábiles contados desde la radicación completa.',
    ],
    vigenteDesde: '2025-11-20T00:00:00.000Z',
    dependenciaResponsable: 'División Financiera',
    enlace: `${ENLACE_BASE}/PA-FIN-004`,
  },
  {
    codigo: 'PA-FIN-009',
    version: '1.2',
    titulo: 'Ampliación de plazos de pago por fallas de canales institucionales',
    extracto:
      'Si un canal de pago institucional falla dentro del plazo, el estudiante puede pagar sin recargo hasta dos días hábiles después de restablecido el servicio.',
    area: 'financiera',
    contenido: [
      '1. Se considera falla del canal toda indisponibilidad registrada como incidente por la División de Sistemas.',
      '2. Durante una falla registrada, los plazos de pago que venzan se amplían automáticamente dos días hábiles después del restablecimiento.',
      '3. No se requiere trámite adicional: el número de incidente sirve de soporte ante la División Financiera.',
    ],
    vigenteDesde: '2026-02-01T00:00:00.000Z',
    dependenciaResponsable: 'División Financiera',
    enlace: `${ENLACE_BASE}/PA-FIN-009`,
  },
  {
    codigo: 'PA-TIC-003',
    version: '3.0',
    titulo: 'Uso aceptable de recursos tecnológicos',
    extracto:
      'Las credenciales institucionales son personales e intransferibles; compartirlas es causal de suspensión temporal de la cuenta.',
    area: 'soporte-tecnico',
    contenido: [
      '1. Las credenciales institucionales son personales e intransferibles.',
      '2. El uso compartido de credenciales es causal de suspensión temporal de la cuenta.',
    ],
    vigenteDesde: '2024-08-01T00:00:00.000Z',
    dependenciaResponsable: 'División de Sistemas',
    enlace: `${ENLACE_BASE}/PA-TIC-003`,
  },
  {
    codigo: 'PA-TIC-007',
    version: '1.4',
    titulo: 'Cuentas institucionales y recuperación de acceso',
    extracto:
      'La contraseña se restablece en línea con el correo alterno registrado; si no hay correo alterno, se requiere validación presencial de identidad.',
    area: 'soporte-tecnico',
    contenido: [
      '1. Toda cuenta institucional debe tener un correo alterno registrado para recuperación.',
      '2. El restablecimiento en línea envía un enlace de un solo uso, válido por 30 minutos, al correo alterno.',
      '3. Tras cinco intentos fallidos la cuenta se bloquea por 15 minutos.',
      '4. Sin correo alterno, la recuperación exige validación presencial de identidad en la División de Sistemas.',
    ],
    vigenteDesde: '2025-03-10T00:00:00.000Z',
    dependenciaResponsable: 'División de Sistemas',
    enlace: `${ENLACE_BASE}/PA-TIC-007`,
  },
  {
    codigo: 'PA-TIC-011',
    version: '1.0',
    titulo: 'Autenticación multifactor',
    extracto:
      'El segundo factor es obligatorio para todas las cuentas; su restablecimiento requiere validar identidad con la División de Sistemas.',
    area: 'soporte-tecnico',
    contenido: [
      '1. La autenticación multifactor es obligatoria para estudiantes, docentes y personal administrativo.',
      '2. La pérdida del dispositivo del segundo factor se reporta a la División de Sistemas, que valida la identidad antes de restablecerlo.',
    ],
    vigenteDesde: '2026-01-05T00:00:00.000Z',
    dependenciaResponsable: 'División de Sistemas',
    enlace: null,
  },
  {
    codigo: 'PA-TIC-015',
    version: '2.1',
    titulo: 'Protección de datos personales en servicios digitales',
    extracto:
      'Ningún funcionario solicitará tu contraseña por chat, correo o teléfono; los procesos de soporte nunca la requieren.',
    area: 'soporte-tecnico',
    contenido: [
      '1. Ningún funcionario ni sistema institucional solicitará la contraseña del usuario por ningún medio.',
      '2. Los datos personales recolectados en procesos de soporte se usan únicamente para atender la solicitud.',
    ],
    vigenteDesde: '2025-09-01T00:00:00.000Z',
    dependenciaResponsable: 'Oficina Jurídica',
    enlace: `${ENLACE_BASE}/PA-TIC-015`,
  },
  {
    codigo: 'PA-VIR-002',
    version: '2.2',
    titulo: 'Continuidad académica ante fallas de la plataforma virtual',
    extracto:
      'Las entregas que venzan durante un incidente registrado de la plataforma se reprograman sin penalización al menos 24 horas después del restablecimiento.',
    area: 'plataforma-virtual',
    contenido: [
      '1. Toda falla de la plataforma virtual registrada como incidente activa el protocolo de continuidad académica.',
      '2. Las actividades evaluativas que venzan durante el incidente se reprograman sin penalización.',
      '3. La nueva fecha no puede ser anterior a 24 horas después del restablecimiento del servicio.',
    ],
    vigenteDesde: '2025-02-01T00:00:00.000Z',
    dependenciaResponsable: 'Dirección de Educación Virtual',
    enlace: `${ENLACE_BASE}/PA-VIR-002`,
  },
  {
    codigo: 'PA-BIB-003',
    version: '1.0',
    titulo: 'Préstamo, renovación y mantenimientos de la biblioteca',
    extracto:
      'Durante un mantenimiento programado los vencimientos de préstamos se extienden automáticamente hasta el siguiente día hábil.',
    area: 'biblioteca',
    contenido: [
      '1. Los mantenimientos del sistema bibliotecario se anuncian con al menos 48 horas de anticipación.',
      '2. Los préstamos que venzan durante la ventana de mantenimiento se extienden automáticamente al siguiente día hábil, sin multa.',
    ],
    vigenteDesde: '2024-06-15T00:00:00.000Z',
    dependenciaResponsable: 'Biblioteca Central',
    enlace: null,
  },
];
