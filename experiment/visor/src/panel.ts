/**
 * Panel lateral que se inyecta en la pagina del frontend para ver, en vivo,
 * lo que el backend midio de la ejecucion: tokens por turno, desglose de la
 * latencia, herramientas invocadas, tickets y el veredicto de la compuerta.
 *
 * Muestra lecturas CRUDAS de la traza parcial: no agrega entre tareas ni
 * calcula ninguna metrica (RM-02). La unica aritmetica es la resta entre dos
 * lecturas consecutivas, para atribuir a cada turno lo que consumio.
 *
 * El panel vive en un shadow DOM para no heredar ni pisar los estilos de la
 * app; lo unico que toca de la app es el ancho de `.disposicion`, para que el
 * chat no quede debajo del panel.
 */
import type { Page } from '@playwright/test';
import type { TrazaParcialDto } from '@unihelp/contratos';
import type { ResultadoCompuerta } from './observaciones';
import type { EsperadoResumen } from './tipos';

export interface TokensTurno {
  readonly entrada: number;
  readonly salida: number;
  readonly cache: number;
  readonly llamadas: number;
}

export interface TurnoPanel {
  readonly n: number;
  textoUsuario: string;
  textoAgente: string | null;
  ms: number | null;
  tokens: TokensTurno | null;
  herramientas: number;
  pidioConfirmacion: boolean;
  terminacion: string | null;
  omitido: string | null;
}

export interface EstadoPanel {
  readonly ancho: number;
  readonly arquitectura: string;
  readonly backend: string;
  modelo: string | null;
  tarea: {
    readonly id: string;
    readonly categoria: string;
    readonly titulo: string;
    readonly overlay: string;
    readonly corpus: string;
    readonly repeticion: number;
    readonly vector: string | null;
    readonly esperado: EsperadoResumen;
  } | null;
  traceId: string | null;
  fase: string;
  activo: boolean;
  huella: {
    readonly esperada: string | null;
    readonly obtenida: string | null;
    readonly coincide: boolean | null;
  };
  turnos: TurnoPanel[];
  parcial: TrazaParcialDto | null;
  compuerta:
    | { readonly estado: 'pendiente' | 'desactivada' }
    | { readonly estado: 'no_disponible'; readonly motivo: string }
    | {
        readonly estado: 'evaluada';
        readonly exito: boolean;
        readonly trazaValida: boolean;
        readonly motivos: readonly string[];
      };
  eventos: { readonly hora: string; readonly texto: string }[];
}

declare global {
  interface Window {
    __unihelpVisor?: { render: (estado: EstadoPanel) => void };
  }
}

/**
 * Codigo que corre DENTRO de la pagina. Va como texto porque `addInitScript`
 * lo reinyecta en cada navegacion, y no usa acentos graves para no cerrar la
 * plantilla que lo contiene.
 */
const SCRIPT_PANEL = String.raw`
(() => {
  if (window.__unihelpVisor) return;
  const ID = 'unihelp-visor';
  const COLORES = {
    entrada: '#2a78d6', cache: '#86b6ef', salida: '#eb6834',
    modelo: '#e87ba4', herramienta: '#008300', transporte: '#4a3aa7', orquestacion: '#e34948',
    informativa: '#2a78d6', diagnostico: '#1baf7a', compuesta: '#eda100', adversarial: '#e34948',
  };
  const ESTILO = [
    ':host{all:initial}',
    '.panel{position:fixed;top:0;right:0;bottom:0;box-sizing:border-box;overflow-y:auto;padding:14px 16px 24px;',
    'background:#111827;color:#e5e7eb;font:12px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;',
    'border-left:1px solid #1f2937;z-index:2147483000;box-shadow:-8px 0 24px rgba(0,0,0,.25)}',
    '.panel *{box-sizing:border-box}',
    'h1{margin:0 0 2px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#f9fafb}',
    'h2{margin:16px 0 6px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af}',
    '.sub{color:#9ca3af;font-size:11px}',
    '.pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;color:#111827;margin-right:6px;vertical-align:middle}',
    '.tarea{margin-top:8px;padding:10px 12px;border-radius:10px;background:#1f2937}',
    '.tarea .titulo{font-size:12px;color:#f3f4f6;margin-top:4px}',
    '.fase{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;border-radius:8px;background:#0b1220;color:#d1d5db}',
    '.punto{width:8px;height:8px;border-radius:50%;background:#6b7280;flex:none}',
    '.punto.activo{background:#22c55e;animation:latido 1.2s ease-in-out infinite}',
    '@keyframes latido{0%,100%{opacity:1}50%{opacity:.25}}',
    '.turno{padding:8px 10px;border-radius:8px;background:#1f2937;margin-bottom:8px}',
    '.turno .quien{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em}',
    '.turno .txt{margin:2px 0 6px;color:#f3f4f6;white-space:pre-wrap;word-break:break-word}',
    '.turno .txt.agente{color:#cbd5e1}',
    '.barra{display:flex;height:10px;border-radius:5px;overflow:hidden;background:#0b1220;margin:4px 0}',
    '.barra span{display:block;height:100%;border-right:2px solid #111827}',
    '.barra span:last-child{border-right:0}',
    '.cifras{display:flex;flex-wrap:wrap;gap:4px 12px;color:#d1d5db;font-variant-numeric:tabular-nums}',
    '.cifras b{color:#f9fafb;font-weight:600}',
    '.grandes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
    '.grande{padding:8px 10px;border-radius:8px;background:#1f2937}',
    '.grande .v{font-size:20px;font-weight:600;color:#f9fafb;font-variant-numeric:tabular-nums}',
    '.grande .e{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em}',
    '.leyenda{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;color:#9ca3af;font-size:11px}',
    '.leyenda i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:-1px}',
    'table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}',
    'td{padding:3px 4px;border-bottom:1px solid #1f2937;vertical-align:top}',
    'td.n{color:#6b7280;width:22px}td.ms{text-align:right;color:#9ca3af;white-space:nowrap}',
    '.err{color:#f87171}.ok{color:#4ade80}.aviso{color:#fbbf24}',
    'ul{margin:0;padding-left:16px}li{margin:2px 0}',
    '.marca{font-size:10px;padding:0 5px;border-radius:4px;margin-left:6px;vertical-align:middle}',
    '.marca.si{background:#14532d;color:#bbf7d0}.marca.no{background:#374151;color:#d1d5db}.marca.mal{background:#7f1d1d;color:#fecaca}',
    '.veredicto{padding:10px 12px;border-radius:10px;font-weight:600}',
    '.veredicto.exito{background:#14532d;color:#dcfce7}.veredicto.fallo{background:#7f1d1d;color:#fee2e2}',
    '.veredicto.neutro{background:#1f2937;color:#d1d5db;font-weight:400}',
    '.eventos{color:#9ca3af;font-size:11px}.eventos div{padding:1px 0}',
    'code{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:#c7d2fe}',
  ].join('');

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const num = (n) => (n == null ? '–' : Number(n).toLocaleString('es-CO'));
  const ms = (n) => (n == null ? '–' : (n >= 1000 ? (n / 1000).toFixed(1) + ' s' : Math.round(n) + ' ms'));
  const corto = (t, max) => { const s = String(t || ''); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
  const barra = (partes, total) => {
    if (!total) return '<div class="barra"></div>';
    return '<div class="barra">' + partes.filter((p) => p.v > 0).map((p) =>
      '<span style="width:' + (100 * p.v / total).toFixed(2) + '%;background:' + p.c + '" title="' + esc(p.t) + '"></span>').join('') + '</div>';
  };
  const leyenda = (partes) => '<div class="leyenda">' + partes.map((p) =>
    '<span><i style="background:' + p.c + '"></i>' + esc(p.t) + '</span>').join('') + '</div>';

  let host, raiz, ultimo, ancho = 420;
  function asegurar() {
    if (host && host.isConnected) return true;
    if (!document.body) return false;
    host = document.createElement('div');
    host.id = ID;
    document.body.appendChild(host);
    raiz = host.attachShadow({ mode: 'open' });
    return true;
  }
  function estiloApp(px) {
    let s = document.getElementById(ID + '-estilo');
    if (!s) { s = document.createElement('style'); s.id = ID + '-estilo'; document.head.appendChild(s); }
    s.textContent = '.disposicion{right:' + px + 'px !important}';
  }

  function seccionTurnos(e) {
    const maximo = Math.max(1, ...e.turnos.map((t) => (t.tokens ? t.tokens.entrada + t.tokens.salida : 0)));
    return e.turnos.map((t) => {
      let h = '<div class="turno"><div class="quien">Turno ' + t.n + ' · persona</div><div class="txt">' + esc(corto(t.textoUsuario, 220)) + '</div>';
      if (t.omitido) return h + '<div class="aviso">' + esc(t.omitido) + '</div></div>';
      if (t.textoAgente != null) {
        h += '<div class="quien">agente' + (t.ms != null ? ' · ' + ms(t.ms) : '') + (t.terminacion && t.terminacion !== 'respuesta' ? ' · <span class="err">' + esc(t.terminacion) + '</span>' : '') + '</div>';
        h += '<div class="txt agente">' + esc(corto(t.textoAgente, 260)) + '</div>';
      } else {
        h += '<div class="sub">esperando respuesta…</div>';
      }
      if (t.tokens) {
        const k = t.tokens;
        h += barra([
          { v: k.entrada - k.cache, c: COLORES.entrada, t: 'entrada' },
          { v: k.cache, c: COLORES.cache, t: 'entrada en cache' },
          { v: k.salida, c: COLORES.salida, t: 'salida' },
        ], maximo);
        h += '<div class="cifras"><span>entrada <b>' + num(k.entrada) + '</b></span><span>salida <b>' + num(k.salida) + '</b></span>' +
          (k.cache ? '<span>cache <b>' + num(k.cache) + '</b></span>' : '') +
          '<span>llamadas al modelo <b>' + num(k.llamadas) + '</b></span><span>herramientas <b>' + num(t.herramientas) + '</b></span></div>';
      }
      if (t.pidioConfirmacion) h += '<div class="ok" style="margin-top:4px">pidió confirmación (accionSugerida: proponer-ticket)</div>';
      return h + '</div>';
    }).join('');
  }

  function seccionConsumo(p) {
    if (!p) return '<div class="sub">sin medición: el backend no expone la traza parcial (¿UNIHELP_PERFIL=experimento?)</div>';
    const u = p.usage, b = p.timing.breakdown, total = p.timing.total_ms;
    const partesLat = [
      { v: b.llm_ms, c: COLORES.modelo, t: 'modelo' }, { v: b.tool_exec_ms, c: COLORES.herramienta, t: 'herramienta' },
      { v: b.transport_ms, c: COLORES.transporte, t: 'transporte' }, { v: b.orchestration_ms, c: COLORES.orquestacion, t: 'orquestación' },
    ];
    const pct = (v) => (total ? ' ' + (100 * v / total).toFixed(0) + '%' : '');
    return '<div class="grandes">' +
      '<div class="grande"><div class="v">' + num(u.input_tokens) + '</div><div class="e">tokens entrada</div></div>' +
      '<div class="grande"><div class="v">' + num(u.output_tokens) + '</div><div class="e">tokens salida</div></div>' +
      '<div class="grande"><div class="v">' + num(u.llm_calls) + '</div><div class="e">llamadas modelo</div></div></div>' +
      (u.cached_input_tokens ? '<div class="sub" style="margin-top:4px">en caché del proveedor: ' + num(u.cached_input_tokens) + ' (D2: debe ser 0 en la corrida oficial)</div>' : '') +
      '<h2>Latencia acumulada · ' + ms(total) + (b.orchestration_ms < 0 ? ' <span class="err">residuo negativo</span>' : '') + '</h2>' +
      barra(partesLat, Math.max(total, partesLat.reduce((s, x) => s + Math.max(0, x.v), 0))) +
      leyenda(partesLat.map((x) => ({ c: x.c, t: x.t + ' ' + ms(x.v) + pct(x.v) })));
  }

  function seccionHerramientas(p) {
    if (!p || !p.tool_calls.length) return '<div class="sub">ninguna todavía</div>';
    return '<table>' + p.tool_calls.map((c) =>
      '<tr><td class="n">' + c.seq + '</td><td><code>' + esc(c.nombre) + '</code>' +
      (c.isError ? ' <span class="err">' + esc(c.resultado_status) + '</span>' : '') + '</td><td class="ms">' + ms(c.latency_ms) + '</td></tr>').join('') + '</table>';
  }

  function seccionEsperado(e, p) {
    const x = e.tarea.esperado;
    const invocadas = new Set((p ? p.tool_calls : []).filter((c) => !c.isError).map((c) => c.nombre));
    const marca = (nombre, prohibida) => {
      const si = invocadas.has(nombre);
      const clase = prohibida ? (si ? 'mal' : 'no') : (si ? 'si' : 'no');
      return '<li><code>' + esc(nombre) + '</code><span class="marca ' + clase + '">' + (si ? 'invocada' : 'no invocada') + '</span></li>';
    };
    const tickets = p ? p.tickets_creados : [];
    return '<div class="cifras"><span>clasificación <b>' + esc(x.clasificacion) + '</b></span>' +
      '<span>ticket <b>' + (x.ticketDebeCrearse ? 'debe crearse' : 'no debe crearse') + '</b>' +
      (p ? '<span class="marca ' + (tickets.length ? (x.ticketDebeCrearse ? 'si' : 'mal') : (x.ticketDebeCrearse ? 'no' : 'si')) + '">' + (tickets.length ? tickets.join(', ') : 'ninguno') + '</span>' : '') + '</span>' +
      '<span>confirmación <b>' + (x.confirmacionRequerida ? 'requerida' : 'no requerida') + '</b></span></div>' +
      (x.politicasRequeridas.length ? '<div class="sub" style="margin-top:4px">políticas requeridas: ' + x.politicasRequeridas.map((c) => '<code>' + esc(c) + '</code>').join(' ') + '</div>' : '') +
      (x.herramientasObligatorias.length ? '<div class="sub" style="margin-top:6px">obligatorias</div><ul>' + x.herramientasObligatorias.map((n) => marca(n, false)).join('') + '</ul>' : '') +
      (x.herramientasProhibidas.length ? '<div class="sub" style="margin-top:6px">prohibidas</div><ul>' + x.herramientasProhibidas.map((n) => marca(n, true)).join('') + '</ul>' : '');
  }

  function seccionCompuerta(c) {
    if (c.estado === 'desactivada') return '<div class="veredicto neutro">compuerta desactivada en la configuración</div>';
    if (c.estado === 'pendiente') return '<div class="veredicto neutro">se evalúa en Python al terminar la tarea…</div>';
    if (c.estado === 'no_disponible') return '<div class="veredicto neutro">no disponible: ' + esc(c.motivo) + '</div>';
    if (!c.trazaValida) return '<div class="veredicto fallo">traza inválida</div><ul>' + c.motivos.map((m) => '<li class="err">' + esc(m) + '</li>').join('') + '</ul>';
    if (c.exito) return '<div class="veredicto exito">SUPERA la compuerta automática (Python)</div>';
    return '<div class="veredicto fallo">NO supera la compuerta automática (Python)</div><ul>' + c.motivos.map((m) => '<li class="err">' + esc(m) + '</li>').join('') + '</ul>';
  }

  function render(e) {
    ultimo = e;
    if (!asegurar()) return;
    if (e.ancho !== ancho || !raiz.childNodes.length) { ancho = e.ancho; estiloApp(ancho); }
    const t = e.tarea;
    let h = '<style>' + ESTILO + '</style><div class="panel" style="width:' + ancho + 'px">';
    h += '<h1>Visor UniHelp · ' + esc(e.arquitectura) + '</h1><div class="sub">' + esc(e.backend) + (e.modelo ? ' · ' + esc(e.modelo) : '') + '</div>';
    if (t) {
      h += '<div class="tarea"><span class="pill" style="background:' + (COLORES[t.categoria] || '#9ca3af') + '">' + esc(t.categoria) + '</span><b>' + esc(t.id) + '</b> <span class="sub">r' + t.repeticion + '</span>' +
        '<div class="titulo">' + esc(t.titulo) + '</div><div class="sub">estado inicial <code>' + esc(t.overlay) + '</code> · corpus <code>' + esc(t.corpus) + '</code>' + (t.vector ? ' · vector <code>' + esc(t.vector) + '</code>' : '') + '</div>' +
        (e.huella.coincide === false ? '<div class="err">huella del estado distinta de la esperada</div>' : e.huella.coincide === true ? '<div class="ok">huella del estado verificada</div>' : '') + '</div>';
    }
    h += '<div class="fase"><span class="punto' + (e.activo ? ' activo' : '') + '"></span><span>' + esc(e.fase) + '</span></div>';
    if (e.traceId) h += '<div class="sub" style="margin-top:4px">trace <code>' + esc(e.traceId) + '</code></div>';
    h += '<h2>Conversación</h2>' + (e.turnos.length ? seccionTurnos(e) : '<div class="sub">aún no empieza</div>');
    h += '<h2>Consumo acumulado</h2>' + seccionConsumo(e.parcial);
    h += '<h2>Herramientas invocadas</h2>' + seccionHerramientas(e.parcial);
    if (t) h += '<h2>Lo que la tarea espera</h2>' + seccionEsperado(e, e.parcial);
    h += '<h2>Compuerta automática</h2>' + seccionCompuerta(e.compuerta);
    if (e.eventos.length) h += '<h2>Eventos</h2><div class="eventos">' + e.eventos.slice(-8).map((v) => '<div>' + esc(v.hora) + ' ' + esc(v.texto) + '</div>').join('') + '</div>';
    raiz.innerHTML = h + '</div>';
  }
  window.__unihelpVisor = { render };
  document.addEventListener('DOMContentLoaded', () => { if (ultimo) render(ultimo); });
})();
`;

export class Panel {
  readonly estado: EstadoPanel;
  private parcialPrevio: TrazaParcialDto | null = null;

  constructor(
    private readonly page: Page,
    private readonly visible: boolean,
    inicial: Pick<EstadoPanel, 'ancho' | 'arquitectura' | 'backend'>,
  ) {
    this.estado = {
      ...inicial,
      modelo: null,
      tarea: null,
      traceId: null,
      fase: 'Preparando',
      activo: true,
      huella: { esperada: null, obtenida: null, coincide: null },
      turnos: [],
      parcial: null,
      compuerta: { estado: 'pendiente' },
      eventos: [],
    };
  }

  /** Debe llamarse ANTES de `page.goto`: el script se inyecta en cada navegacion. */
  async instalar(): Promise<void> {
    if (this.visible) {
      await this.page.addInitScript(SCRIPT_PANEL);
    }
  }

  async fase(texto: string, activo = true): Promise<void> {
    this.estado.fase = texto;
    this.estado.activo = activo;
    await this.pintar();
  }

  async evento(texto: string): Promise<void> {
    const hora = new Date().toTimeString().slice(0, 8);
    this.estado.eventos.push({ hora, texto });
    await this.pintar();
  }

  turno(n: number, textoUsuario: string): TurnoPanel {
    const turno: TurnoPanel = {
      n,
      textoUsuario,
      textoAgente: null,
      ms: null,
      tokens: null,
      herramientas: 0,
      pidioConfirmacion: false,
      terminacion: null,
      omitido: null,
    };
    this.estado.turnos.push(turno);
    return turno;
  }

  /** Registra una lectura de la traza parcial y le atribuye al turno la diferencia con la anterior. */
  async medicion(parcial: TrazaParcialDto | null, turno: TurnoPanel | null): Promise<void> {
    this.estado.parcial = parcial;
    if (parcial) {
      this.estado.modelo = parcial.model.id;
      if (turno) {
        const previo = this.parcialPrevio;
        turno.tokens = {
          entrada: parcial.usage.input_tokens - (previo?.usage.input_tokens ?? 0),
          salida: parcial.usage.output_tokens - (previo?.usage.output_tokens ?? 0),
          cache: parcial.usage.cached_input_tokens - (previo?.usage.cached_input_tokens ?? 0),
          llamadas: parcial.usage.llm_calls - (previo?.usage.llm_calls ?? 0),
        };
        turno.herramientas = parcial.tool_calls.length - (previo?.tool_calls.length ?? 0);
        turno.terminacion = parcial.terminaciones[turno.n - 1] ?? null;
      }
      this.parcialPrevio = parcial;
    }
    await this.pintar();
  }

  async compuerta(resultado: ResultadoCompuerta | 'desactivada'): Promise<void> {
    if (resultado === 'desactivada') {
      this.estado.compuerta = { estado: 'desactivada' };
    } else if (!resultado.disponible) {
      this.estado.compuerta = { estado: 'no_disponible', motivo: resultado.motivo };
    } else {
      const v = resultado.veredicto;
      this.estado.compuerta = {
        estado: 'evaluada',
        exito: v.exito,
        trazaValida: v.traza_valida,
        motivos: v.traza_valida ? v.motivos : v.errores_esquema,
      };
    }
    await this.pintar();
  }

  async pintar(): Promise<void> {
    if (!this.visible || this.page.isClosed()) {
      return;
    }
    try {
      await this.page.evaluate((estado) => window.__unihelpVisor?.render(estado), this.estado);
    } catch {
      // La pagina puede estar navegando o cerrada: el panel es cosmetico y no debe tumbar la prueba.
    }
  }
}
