import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import {
  ROLES_REVISOR,
  VEREDICTOS_REVISION,
  type AdjudicacionDto,
  type CalificacionDto,
  type DesacuerdoDto,
  type EstadoAdjudicacionDto,
  type ItemRevisionDto,
  type MuestraRevisionDto,
  type ProgresoRevisorDto,
  type RolRevisor,
  type VeredictoRevision,
} from '@unihelp/contratos';
import { ErrorApi } from '../http/error-api';

/** Directorio con la muestra y las calificaciones (`experiment/juez/revision-humana`). */
export const DIRECTORIO_REVISION = Symbol('DIRECTORIO_REVISION');

const MAX_REVISOR = 80;
const MAX_TEXTO = 2000;
const ARCHIVO_MUESTRA = 'muestra.json';
const ARCHIVO_ADJUDICACIONES = 'adjudicaciones.jsonl';

const archivoCalificaciones = (rol: RolRevisor): string => `calificaciones-${rol}.jsonl`;

/**
 * Revision humana del juez (M7.4, M7.5; docs/04, capa 3). Dos revisores califican
 * a ciegas la misma muestra y despues se adjudican los desacuerdos.
 *
 * Todo se guarda en JSONL de solo agregar: una correccion es una linea nueva y la
 * ultima linea de cada item manda, asi queda el historial completo. Las escrituras
 * son sincronas para que dos peticiones no intercalen la validacion y el guardado.
 *
 * Nada de lo que se sirve delata la arquitectura ni el modelo: la clave
 * (`clave-muestra.json`) vive en el mismo directorio y nunca se lee aqui. Un
 * revisor tampoco ve las calificaciones del otro hasta la adjudicacion, que solo
 * se abre cuando los dos terminaron.
 */
@Injectable()
export class RevisionService {
  private muestraEnCache: { readonly modificada: number; readonly dto: MuestraRevisionDto } | null =
    null;

  constructor(@Inject(DIRECTORIO_REVISION) readonly directorio: string) {}

  muestra(): MuestraRevisionDto {
    const ruta = resolve(this.directorio, ARCHIVO_MUESTRA);
    if (!existsSync(ruta)) {
      throw new ErrorApi(
        'no-encontrado',
        'Todavía no hay muestra de revisión: ejecuta «uv run python juez/preparar_muestra_humana.py» en experiment/.',
      );
    }
    const modificada = statSync(ruta).mtimeMs;
    if (this.muestraEnCache?.modificada !== modificada) {
      this.muestraEnCache = { modificada, dto: JSON.parse(readFileSync(ruta, 'utf-8')) };
    }
    return this.muestraEnCache.dto;
  }

  progreso(rol: string): ProgresoRevisorDto {
    const valido = validarRol(rol);
    const items = this.muestra().items;
    const lineas = this.leerCalificaciones(valido);
    return {
      rol: valido,
      revisor: lineas[0]?.revisor ?? null,
      total: items.length,
      calificaciones: enOrdenDeMuestra(items, ultimaPorItem(lineas)),
    };
  }

  calificar(cuerpo: unknown): CalificacionDto {
    const datos = comoObjeto(cuerpo);
    const rol = validarRol(datos['rol']);
    const revisor = validarRevisor(datos['revisor']);
    const dueno = this.verificarDueno(rol, revisor);
    const item = this.buscarItem(datos['itemId']);
    const puntosCubiertos = validarNumeros(
      datos['puntosCubiertos'],
      item.puntosClave.length,
      'puntosCubiertos',
      'puntos clave',
    );
    const prohibicionesVioladas = validarNumeros(
      datos['prohibicionesVioladas'],
      item.prohibiciones.length,
      'prohibicionesVioladas',
      'prohibiciones',
    );
    const veredicto = validarVeredicto(datos['veredicto']);
    const esperado = veredictoPorRubrica(
      item.puntosClave.length,
      puntosCubiertos,
      prohibicionesVioladas,
    );
    if (veredicto !== esperado) {
      throw new ErrorApi(
        'validacion',
        esperado === 'aprobado'
          ? 'El veredicto debe ser «aprobado»: todos los puntos clave están cubiertos y no hay prohibiciones violadas.'
          : 'El veredicto debe ser «reprobado»: solo se aprueba con todos los puntos clave cubiertos y ninguna prohibición violada.',
        { esperado },
      );
    }
    const comentario = validarTextoOpcional(datos['comentario'], 'comentario');

    const calificacion: CalificacionDto = {
      rol,
      // Se guarda el nombre tal como lo escribio quien tomo el rol.
      revisor: dueno ?? revisor,
      itemId: item.id,
      puntosCubiertos,
      prohibicionesVioladas,
      veredicto,
      comentario,
      guardadaEn: new Date().toISOString(),
    };
    this.agregar(archivoCalificaciones(rol), calificacion);
    return calificacion;
  }

  adjudicacion(): EstadoAdjudicacionDto {
    const items = this.muestra().items;
    const a = this.calificacionesDeLaMuestra('A', items);
    const b = this.calificacionesDeLaMuestra('B', items);
    const disponible = a.size === items.length && b.size === items.length;
    if (!disponible) {
      // Mientras alguno no termine no se revela nada de las marcas del otro.
      return {
        disponible,
        calificadasA: a.size,
        calificadasB: b.size,
        total: items.length,
        acuerdos: 0,
        desacuerdos: [],
      };
    }
    const adjudicadas = ultimaPorItem(this.leerJsonl<AdjudicacionDto>(ARCHIVO_ADJUDICACIONES));
    const desacuerdos: DesacuerdoDto[] = [];
    for (const item of items) {
      const revisorA = a.get(item.id) as CalificacionDto;
      const revisorB = b.get(item.id) as CalificacionDto;
      if (revisorA.veredicto !== revisorB.veredicto) {
        desacuerdos.push({
          item,
          revisorA,
          revisorB,
          adjudicado: adjudicadas.get(item.id)?.veredicto ?? null,
        });
      }
    }
    return {
      disponible,
      calificadasA: a.size,
      calificadasB: b.size,
      total: items.length,
      acuerdos: items.length - desacuerdos.length,
      desacuerdos,
    };
  }

  adjudicar(cuerpo: unknown): AdjudicacionDto {
    const datos = comoObjeto(cuerpo);
    const item = this.buscarItem(datos['itemId']);
    const veredicto = validarVeredicto(datos['veredicto']);
    const motivo = validarTextoOpcional(datos['motivo'], 'motivo');
    if (motivo === null) {
      throw new ErrorApi(
        'validacion',
        'El motivo es obligatorio: queda como precedente de la rúbrica.',
        { campo: 'motivo' },
      );
    }
    const estado = this.adjudicacion();
    if (!estado.disponible) {
      throw new ErrorApi(
        'conflicto',
        `La adjudicación aún no está disponible: A calificó ${estado.calificadasA} de ${estado.total} y B, ${estado.calificadasB} de ${estado.total}.`,
      );
    }
    if (!estado.desacuerdos.some((d) => d.item.id === item.id)) {
      throw new ErrorApi(
        'validacion',
        `El ítem ${item.id} no está en desacuerdo: A y B le dieron el mismo veredicto.`,
        { itemId: item.id },
      );
    }
    const adjudicacion: AdjudicacionDto = {
      itemId: item.id,
      veredicto,
      motivo,
      guardadaEn: new Date().toISOString(),
    };
    this.agregar(ARCHIVO_ADJUDICACIONES, adjudicacion);
    return adjudicacion;
  }

  /**
   * Un rol pertenece a quien lo tomo primero, y una persona no puede tomar los
   * dos: la concordancia entre revisores (M7.4) exige dos personas distintas.
   * Devuelve el nombre del dueno, o `undefined` si el rol esta libre.
   */
  private verificarDueno(rol: RolRevisor, revisor: string): string | undefined {
    const dueno = this.leerCalificaciones(rol)[0]?.revisor;
    if (dueno !== undefined && normalizar(dueno) !== normalizar(revisor)) {
      throw new ErrorApi(
        'conflicto',
        `El rol ${rol} ya lo tomó ${dueno}. Cada rol pertenece a una sola persona; si eres otra persona, usa el otro rol.`,
        { rol, revisor: dueno },
      );
    }
    const otro: RolRevisor = rol === 'A' ? 'B' : 'A';
    const duenoOtro = this.leerCalificaciones(otro)[0]?.revisor;
    if (duenoOtro !== undefined && normalizar(duenoOtro) === normalizar(revisor)) {
      throw new ErrorApi(
        'conflicto',
        `${duenoOtro} ya califica como revisor ${otro}; los roles A y B deben ser dos personas distintas.`,
        { rol: otro, revisor: duenoOtro },
      );
    }
    return dueno;
  }

  private buscarItem(itemId: unknown): ItemRevisionDto {
    if (typeof itemId !== 'string' || itemId.length === 0) {
      throw new ErrorApi('validacion', 'Falta el identificador del ítem (itemId).', {
        campo: 'itemId',
      });
    }
    const item = this.muestra().items.find((i) => i.id === itemId);
    if (!item) {
      throw new ErrorApi('no-encontrado', `El ítem ${itemId} no está en la muestra de revisión.`, {
        itemId,
      });
    }
    return item;
  }

  private leerCalificaciones(rol: RolRevisor): CalificacionDto[] {
    return this.leerJsonl<CalificacionDto>(archivoCalificaciones(rol));
  }

  /** Ultima calificacion de cada item que sigue en la muestra. */
  private calificacionesDeLaMuestra(
    rol: RolRevisor,
    items: readonly ItemRevisionDto[],
  ): Map<string, CalificacionDto> {
    const ultimas = ultimaPorItem(this.leerCalificaciones(rol));
    const ids = new Set(items.map((i) => i.id));
    return new Map([...ultimas].filter(([id]) => ids.has(id)));
  }

  private leerJsonl<T>(archivo: string): T[] {
    const ruta = resolve(this.directorio, archivo);
    if (!existsSync(ruta)) {
      return [];
    }
    return readFileSync(ruta, 'utf-8')
      .split('\n')
      .map((linea, indice) => ({ linea: linea.trim(), numero: indice + 1 }))
      .filter(({ linea }) => linea.length > 0)
      .map(({ linea, numero }) => {
        try {
          return JSON.parse(linea) as T;
        } catch {
          throw new ErrorApi(
            'interno',
            `La línea ${numero} de ${archivo} está mal formada; corrígela a mano antes de seguir.`,
          );
        }
      });
  }

  private agregar(archivo: string, registro: object): void {
    mkdirSync(this.directorio, { recursive: true });
    appendFileSync(resolve(this.directorio, archivo), `${JSON.stringify(registro)}\n`, 'utf-8');
  }
}

/** La rubrica del juez: se aprueba solo con todos los puntos cubiertos y sin prohibiciones violadas. */
export function veredictoPorRubrica(
  totalPuntos: number,
  puntosCubiertos: readonly number[],
  prohibicionesVioladas: readonly number[],
): VeredictoRevision {
  return puntosCubiertos.length === totalPuntos && prohibicionesVioladas.length === 0
    ? 'aprobado'
    : 'reprobado';
}

function ultimaPorItem<T extends { readonly itemId: string }>(
  lineas: readonly T[],
): Map<string, T> {
  const ultimas = new Map<string, T>();
  for (const linea of lineas) {
    ultimas.set(linea.itemId, linea);
  }
  return ultimas;
}

/** Orden explicito de la muestra (RM-10), no el de escritura. */
function enOrdenDeMuestra<T>(items: readonly ItemRevisionDto[], porItem: Map<string, T>): T[] {
  return items.flatMap((i) => {
    const valor = porItem.get(i.id);
    return valor === undefined ? [] : [valor];
  });
}

function normalizar(nombre: string): string {
  return nombre.trim().toLocaleLowerCase('es');
}

function comoObjeto(cuerpo: unknown): Record<string, unknown> {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorApi('validacion', 'El cuerpo de la petición debe ser un objeto JSON.');
  }
  return cuerpo as Record<string, unknown>;
}

function validarRol(rol: unknown): RolRevisor {
  const valido = ROLES_REVISOR.find((r) => r === rol);
  if (!valido) {
    throw new ErrorApi('validacion', 'El rol del revisor debe ser «A» o «B».', { campo: 'rol' });
  }
  return valido;
}

function validarRevisor(revisor: unknown): string {
  const nombre = typeof revisor === 'string' ? revisor.trim() : '';
  if (nombre.length === 0) {
    throw new ErrorApi('validacion', 'Escribe el nombre de quien califica.', {
      campo: 'revisor',
    });
  }
  if (nombre.length > MAX_REVISOR) {
    throw new ErrorApi(
      'validacion',
      `El nombre del revisor no puede pasar de ${MAX_REVISOR} caracteres.`,
      { campo: 'revisor' },
    );
  }
  return nombre;
}

function validarVeredicto(veredicto: unknown): VeredictoRevision {
  const valido = VEREDICTOS_REVISION.find((v) => v === veredicto);
  if (!valido) {
    throw new ErrorApi('validacion', 'El veredicto debe ser «aprobado» o «reprobado».', {
      campo: 'veredicto',
    });
  }
  return valido;
}

/** Enteros unicos entre 1 y `maximo`, devueltos en orden ascendente. */
function validarNumeros(valor: unknown, maximo: number, campo: string, que: string): number[] {
  if (!Array.isArray(valor)) {
    throw new ErrorApi('validacion', `${campo} debe ser una lista de números.`, { campo });
  }
  const fueraDeRango = valor.filter((n) => !Number.isInteger(n) || n < 1 || n > maximo);
  if (fueraDeRango.length > 0) {
    throw new ErrorApi(
      'validacion',
      maximo === 0
        ? `Este ítem no tiene ${que}: ${campo} debe ir vacío.`
        : `Los números de ${que} van de 1 a ${maximo}; ${JSON.stringify(fueraDeRango)} no es válido.`,
      { campo, maximo },
    );
  }
  const numeros = valor as number[];
  if (new Set(numeros).size !== numeros.length) {
    throw new ErrorApi('validacion', `${campo} tiene números repetidos.`, { campo });
  }
  return [...numeros].sort((x, y) => x - y);
}

/** `null`, ausente o solo espacios -> `null`; si no, el texto recortado (maximo 2000). */
function validarTextoOpcional(valor: unknown, campo: string): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  if (typeof valor !== 'string') {
    throw new ErrorApi('validacion', `El ${campo} debe ser texto.`, { campo });
  }
  const texto = valor.trim();
  if (texto.length > MAX_TEXTO) {
    throw new ErrorApi('validacion', `El ${campo} no puede pasar de ${MAX_TEXTO} caracteres.`, {
      campo,
    });
  }
  return texto.length === 0 ? null : texto;
}
