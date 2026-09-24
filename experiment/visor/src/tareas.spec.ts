import {
  ErrorTareas,
  cargarTareas,
  huellaEsperada,
  huellasPorVariante,
  interpretarTarea,
  seleccionarTareas,
} from './tareas';

describe('tareas del visor', () => {
  const todas = cargarTareas();

  it('lee las 40 tareas de docs/tasks en orden de id', () => {
    expect(todas).toHaveLength(40);
    expect(todas.map((t) => t.id)).toEqual([...todas.map((t) => t.id)].sort());
    expect(new Set(todas.map((t) => t.categoria))).toEqual(
      new Set(['informativa', 'diagnostico', 'compuesta', 'adversarial']),
    );
  });

  it('el corpus adversarial es solo para la carga que vive en una politica, como en Python', () => {
    const adversarial = todas.filter((t) => t.corpus === 'adversarial').map((t) => t.id);
    expect(adversarial).toEqual(['T-ADV-001', 'T-ADV-002', 'T-ADV-003']);
  });

  it('el turno de confirmacion lleva su condicion y la tarea compuesta espera ticket', () => {
    const compuesta = todas.find((t) => t.id === 'T-COM-001');
    expect(compuesta?.turnos[1]?.condicionDeEnvio).toBe('agente_pidio_confirmacion');
    expect(compuesta?.esperado.ticketDebeCrearse).toBe(true);
    expect(compuesta?.esperado.herramientasObligatorias).toContain('proponer_ticket');
  });

  it('selecciona por id y por comodin, y falla si nada coincide', () => {
    expect(seleccionarTareas(todas, ['T-COM-001', 'T-ADV-*']).map((t) => t.id)).toEqual([
      'T-ADV-001',
      'T-ADV-002',
      'T-ADV-003',
      'T-ADV-004',
      'T-ADV-005',
      'T-ADV-006',
      'T-ADV-007',
      'T-ADV-008',
      'T-ADV-009',
      'T-ADV-010',
      'T-COM-001',
    ]);
    expect(seleccionarTareas(todas, null)).toBe(todas);
    expect(() => seleccionarTareas(todas, ['T-XXX-999'])).toThrow(ErrorTareas);
  });

  it('toda tarea tiene huella esperada en huellas-variantes.json', () => {
    const variantes = huellasPorVariante();
    for (const tarea of todas) {
      expect(huellaEsperada(tarea, variantes)).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it('rechaza una tarea mal formada', () => {
    expect(() => interpretarTarea({ id: 'X' }, 'x.yaml')).toThrow(/forma T-XXX-000/);
    expect(() =>
      interpretarTarea(
        { id: 'T-INF-999', estado_inicial: { overlay: 'todo_operativo' }, conversacion: [] },
        'x.yaml',
      ),
    ).toThrow(/ningun turno/);
    expect(() =>
      interpretarTarea(
        {
          id: 'T-INF-999',
          estado_inicial: { overlay: 'todo_operativo' },
          conversacion: [{ rol: 'usuario', texto: 'hola', condicion_de_envio: 'siempre' }],
        },
        'x.yaml',
      ),
    ).toThrow(/condicion_de_envio/);
  });
});
