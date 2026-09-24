import { esIdentificadorArquitectura } from '@unihelp/dominio';
import { ErrorBackend } from '../../../domain/errors/error-backend';
import {
  CLASIFICACIONES_ESPERADAS,
  CONDICION_CONFIRMACION,
  type ClasificacionEsperada,
  type HerramientaObligatoria,
  type ServicioEstadoInicial,
  type TareaEvaluacion,
  type TurnoTarea,
  esCategoriaTarea,
  esVectorAdversarial,
} from '../../../domain/models/experimento/tarea-evaluacion';

/**
 * Convierte el YAML de una tarea (ya parseado a objeto) en `TareaEvaluacion`.
 * Estrecha cada campo desde `unknown`: un YAML que no trae lo obligatorio
 * rechaza con `validacion` en vez de producir una tarea a medias, igual que
 * hace `experiment/ejecutor/tareas.py`.
 */
export function mapearTareaEvaluacion(crudo: unknown): TareaEvaluacion {
  const datos = objeto(crudo, 'tarea');
  const id = texto(datos, 'id');
  const categoria = datos['categoria'];
  if (!esCategoriaTarea(categoria)) {
    throw fallo(`${id}: categoria desconocida «${String(categoria)}».`);
  }
  const esperado = objeto(datos['esperado'], `${id}.esperado`);
  const clasificacion = esperado['clasificacion'];
  if (!esClasificacion(clasificacion)) {
    throw fallo(`${id}: clasificacion esperada desconocida «${String(clasificacion)}».`);
  }
  const estadoInicial = objeto(datos['estado_inicial'], `${id}.estado_inicial`);
  const confirmacion = objeto(esperado['confirmacion'] ?? {}, `${id}.confirmacion`);
  const ticket = objeto(esperado['ticket'] ?? {}, `${id}.ticket`);
  const adversario = datos['adversario'];

  return {
    id,
    categoria,
    titulo: texto(datos, 'titulo'),
    servicios: listaTextos(datos['servicios']),
    arquitecturas: listaTextos(datos['arquitecturas']).filter(esIdentificadorArquitectura),
    ejes: listaTextos(datos['ejes']),
    etiquetas: listaTextos(datos['etiquetas']),
    conversacion: turnos(datos['conversacion'], id),
    estadoInicial: {
      overlay: texto(estadoInicial, 'overlay'),
      servicios: serviciosIniciales(estadoInicial['servicios']),
    },
    esperado: {
      clasificacion,
      politicasRequeridas: listaTextos(esperado['politicas_requeridas']),
      politicasProhibidas: listaTextos(esperado['politicas_prohibidas']),
      herramientasObligatorias: herramientas(esperado['herramientas_obligatorias']),
      herramientasProhibidas: listaTextos(esperado['herramientas_prohibidas']),
      ordenParcial: ordenParcial(esperado['orden_parcial']),
      confirmacionRequerida: confirmacion['requerida'] === true,
      confirmacionEsperadaDelUsuario:
        confirmacion['esperada_del_usuario'] === 'otorgada' ||
        confirmacion['esperada_del_usuario'] === 'negada'
          ? confirmacion['esperada_del_usuario']
          : null,
      ticket: {
        debeCrearse: ticket['debe_crearse'] === true,
        servicio: textoOpcional(ticket['servicio']),
        prioridad: textoOpcional(ticket['prioridad']),
        categoria: textoOpcional(ticket['categoria']),
      },
      puntosClaveRespuesta: listaTextos(esperado['puntos_clave_respuesta']),
      prohibicionesRespuesta: listaTextos(esperado['prohibiciones_respuesta']),
    },
    maxTurnosAgente: entero(datos['max_turnos_agente'], 8),
    timeoutS: entero(datos['timeout_s'], 120),
    adversario:
      adversario === undefined || adversario === null ? null : mapearAdversario(adversario, id),
  };
}

function mapearAdversario(crudo: unknown, id: string): TareaEvaluacion['adversario'] {
  const datos = objeto(crudo, `${id}.adversario`);
  const vector = datos['vector'];
  if (!esVectorAdversarial(vector)) {
    throw fallo(`${id}: vector adversarial desconocido «${String(vector)}».`);
  }
  return {
    vector,
    ubicacion: texto(datos, 'ubicacion'),
    recorrido: textoOpcional(datos['recorrido']),
    resultadoEsperado: texto(datos, 'resultado_esperado'),
    carga: textoOpcional(datos['carga']),
  };
}

function turnos(crudo: unknown, id: string): TurnoTarea[] {
  const lista = Array.isArray(crudo) ? crudo : [];
  if (lista.length === 0) {
    throw fallo(`${id}: la tarea no tiene turnos de la persona.`);
  }
  return lista.map((bruto, indice) => {
    const turno = objeto(bruto, `${id}.conversacion[${indice}]`);
    const condicion = turno['condicion_de_envio'];
    if (condicion !== undefined && condicion !== null && condicion !== CONDICION_CONFIRMACION) {
      throw fallo(`${id}: condicion_de_envio desconocida «${String(condicion)}».`);
    }
    return {
      texto: texto(turno, 'texto'),
      condicionDeEnvio: condicion === CONDICION_CONFIRMACION ? CONDICION_CONFIRMACION : null,
    };
  });
}

function serviciosIniciales(crudo: unknown): ServicioEstadoInicial[] {
  if (!esObjeto(crudo)) {
    return [];
  }
  // El orden del YAML es el de docs/10; se conserva porque es el que conoce quien lo escribio.
  return Object.entries(crudo).map(([servicio, valor]) => {
    const estado = esObjeto(valor) ? valor : {};
    return {
      servicio,
      estado: textoOpcional(estado['estado']) ?? 'OPERATIVO',
      alcance: textoOpcional(estado['alcance']),
      componentesAfectados: listaTextos(estado['componentes_afectados']),
      mensaje: textoOpcional(estado['mensaje']),
    };
  });
}

function herramientas(crudo: unknown): HerramientaObligatoria[] {
  if (!Array.isArray(crudo)) {
    return [];
  }
  return crudo.map((bruto) => {
    const herramienta = objeto(bruto, 'herramienta obligatoria');
    const args = esObjeto(herramienta['args_parciales']) ? herramienta['args_parciales'] : {};
    return {
      nombre: texto(herramienta, 'nombre'),
      argsParciales: Object.fromEntries(
        Object.entries(args).map(([clave, valor]) => [clave, String(valor)]),
      ),
    };
  });
}

function ordenParcial(crudo: unknown): (readonly [string, string])[] {
  if (!Array.isArray(crudo)) {
    return [];
  }
  return crudo
    .filter((pareja): pareja is unknown[] => Array.isArray(pareja) && pareja.length === 2)
    .map((pareja) => [String(pareja[0]), String(pareja[1])] as const);
}

function esClasificacion(valor: unknown): valor is ClasificacionEsperada {
  return (
    typeof valor === 'string' && (CLASIFICACIONES_ESPERADAS as readonly string[]).includes(valor)
  );
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function objeto(valor: unknown, nombre: string): Record<string, unknown> {
  if (!esObjeto(valor)) {
    throw fallo(`${nombre}: se esperaba un objeto.`);
  }
  return valor;
}

function texto(datos: Record<string, unknown>, clave: string): string {
  const valor = datos[clave];
  if (typeof valor !== 'string' || valor.length === 0) {
    throw fallo(`Falta el campo obligatorio «${clave}».`);
  }
  return valor;
}

function textoOpcional(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

function listaTextos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.map((elemento) => String(elemento)) : [];
}

function entero(valor: unknown, porDefecto: number): number {
  return typeof valor === 'number' && Number.isInteger(valor) ? valor : porDefecto;
}

function fallo(mensaje: string): ErrorBackend {
  return new ErrorBackend('validacion', `Tarea invalida: ${mensaje}`);
}
