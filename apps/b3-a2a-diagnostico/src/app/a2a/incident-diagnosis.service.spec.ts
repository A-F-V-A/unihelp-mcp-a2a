import { CapacidadesMcpDiagnostico } from '../capacidades-mcp/capacidades-mcp-diagnostico';
import { detectarServicio, IncidentDiagnosisService } from './incident-diagnosis.service';

describe('IncidentDiagnosisService (HU-09 a HU-12, HU-30)', () => {
  let service: IncidentDiagnosisService;
  let mockCapacidadesMcp: { consultarEstadoServicio: jest.Mock };

  beforeEach(() => {
    mockCapacidadesMcp = {
      consultarEstadoServicio: jest.fn(),
    };
    service = new IncidentDiagnosisService(
      mockCapacidadesMcp as unknown as CapacidadesMcpDiagnostico,
    );
  });

  describe('detectarServicio', () => {
    it('debe detectar correo_institucional', () => {
      expect(detectarServicio('No puedo entrar a mi buzón de correo')).toBe('correo_institucional');
      expect(detectarServicio('Rebotan mis emails institucionales')).toBe('correo_institucional');
    });

    it('debe detectar matricula', () => {
      expect(detectarServicio('Error al inscribir asignaturas en matrícula')).toBe('matricula');
    });

    it('debe detectar autenticacion', () => {
      expect(detectarServicio('Olvidé mi contraseña y cuenta bloqueada')).toBe('autenticacion');
    });

    it('debe defaulting a aula_virtual para otros problemas', () => {
      expect(detectarServicio('No carga el cuestionario del examen')).toBe('aula_virtual');
    });
  });

  describe('priorización institucional y acciones recomendadas', () => {
    it('debe asignar P1 y crear_ticket para FUERA_DE_SERVICIO (HU-11)', async () => {
      mockCapacidadesMcp.consultarEstadoServicio.mockResolvedValueOnce({
        estado: {
          servicio: 'aula_virtual',
          estado: 'FUERA_DE_SERVICIO',
          alcance: 'total',
          componentes_afectados: ['core'],
          incidente_ref: 'INC-001',
        },
        durMs: 10,
        rttMs: 15,
      });

      const res = await service.ejecutarDiagnostico('Aula caída totalmente');
      const data = res.artefacto.parts[0]?.kind === 'data' ? res.artefacto.parts[0].data : null;

      expect(data?.prioridad_sugerida).toBe('P1');
      expect(data?.accion_recomendada).toBe('crear_ticket');
      expect(data?.estado).toBe('FUERA_DE_SERVICIO');
    });

    it('debe asignar P2 y crear_ticket para DEGRADADO con alcance total (HU-11)', async () => {
      mockCapacidadesMcp.consultarEstadoServicio.mockResolvedValueOnce({
        estado: {
          servicio: 'correo_institucional',
          estado: 'DEGRADADO',
          alcance: 'total',
          componentes_afectados: ['imap'],
          incidente_ref: 'INC-002',
        },
        durMs: 10,
        rttMs: 15,
      });

      const res = await service.ejecutarDiagnostico('Correo muy lento en toda la universidad');
      const data = res.artefacto.parts[0]?.kind === 'data' ? res.artefacto.parts[0].data : null;

      expect(data?.prioridad_sugerida).toBe('P2');
      expect(data?.accion_recomendada).toBe('crear_ticket');
    });

    it('debe asignar P3 y crear_ticket para DEGRADADO con alcance parcial (HU-11)', async () => {
      mockCapacidadesMcp.consultarEstadoServicio.mockResolvedValueOnce({
        estado: {
          servicio: 'aula_virtual',
          estado: 'DEGRADADO',
          alcance: 'parcial',
          componentes_afectados: ['subida_archivos'],
          incidente_ref: 'INC-003',
        },
        durMs: 10,
        rttMs: 15,
      });

      const res = await service.ejecutarDiagnostico('Lentitud al subir archivos');
      const data = res.artefacto.parts[0]?.kind === 'data' ? res.artefacto.parts[0].data : null;

      expect(data?.prioridad_sugerida).toBe('P3');
      expect(data?.accion_recomendada).toBe('crear_ticket');
    });

    it('debe asignar P4 e informar_y_esperar para MANTENIMIENTO programado (HU-12)', async () => {
      mockCapacidadesMcp.consultarEstadoServicio.mockResolvedValueOnce({
        estado: {
          servicio: 'matricula',
          estado: 'MANTENIMIENTO',
          alcance: 'programado',
          componentes_afectados: ['inscripciones'],
          incidente_ref: null,
        },
        durMs: 10,
        rttMs: 15,
      });

      const res = await service.ejecutarDiagnostico('No puedo matricular por mantenimiento');
      const data = res.artefacto.parts[0]?.kind === 'data' ? res.artefacto.parts[0].data : null;

      expect(data?.prioridad_sugerida).toBe('P4');
      expect(data?.accion_recomendada).toBe('informar_y_esperar');
    });

    it('debe asignar P4 y sin_accion para OPERATIVO', async () => {
      mockCapacidadesMcp.consultarEstadoServicio.mockResolvedValueOnce({
        estado: {
          servicio: 'autenticacion',
          estado: 'OPERATIVO',
          alcance: 'ninguno',
          componentes_afectados: [],
          incidente_ref: null,
        },
        durMs: 10,
        rttMs: 15,
      });

      const res = await service.ejecutarDiagnostico('Duda sobre mi acceso');
      const data = res.artefacto.parts[0]?.kind === 'data' ? res.artefacto.parts[0].data : null;

      expect(data?.prioridad_sugerida).toBe('P4');
      expect(data?.accion_recomendada).toBe('sin_accion');
    });
  });
});
