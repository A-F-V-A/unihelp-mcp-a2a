"""Remuestreo pareado por conglomerados (HU-MET-05, plan de medicion seccion 14).

La unidad de OBSERVACION es la ejecucion; la unidad de ANALISIS es la tarea. Las
repeticiones de una tarea comparten enunciado, estado inicial y criterio de exito:
no son independientes. Por eso este modulo NUNCA recibe ejecuciones. Recibe una
`MatrizTareas` (una fila por tarea, una columna por arquitectura) y remuestrea
FILAS completas: al elegir una tarea arrastra juntas sus cuatro arquitecturas, lo
que conserva el pareo y permite contrastes dentro de cada tarea.

El tamano de muestra que se cita es el numero de tareas (40), nunca 800.
"""

from __future__ import annotations

import warnings
from collections.abc import Callable, Sequence
from dataclasses import dataclass

import numpy as np
import pandas as pd

AGREGADORES: dict[str, Callable[..., np.ndarray]] = {
    'media': np.nanmean,
    'mediana': np.nanmedian,
}

_MENSAJE_NO_MATRIZ = (
    'El remuestreo opera sobre TAREAS, no sobre ejecuciones: recibe una MatrizTareas '
    '(una fila por tarea y una columna por arquitectura), no {tipo}. Agregue primero las '
    'repeticiones de cada tarea y construya la matriz con MatrizTareas.desde_tabla().'
)


@dataclass(frozen=True)
class ConfiguracionBootstrap:
    """Replicas, nivel y semilla. La semilla queda registrada en resultados.json."""

    replicas: int
    nivel: float
    semilla: int

    def __post_init__(self) -> None:
        if self.replicas < 1:
            raise ValueError('replicas debe ser positivo')
        if not 0 < self.nivel < 1:
            raise ValueError('nivel debe estar en (0, 1)')


@dataclass(frozen=True)
class Intervalo:
    inferior: float
    superior: float
    nivel: float


@dataclass(frozen=True)
class Estimacion:
    """Valor puntual, intervalo y numero de tareas con dato (el tamano de muestra)."""

    valor: float | None
    intervalo: Intervalo | None
    n_tareas: int


class MatrizTareas:
    """Valores ya agregados por tarea: forma (tareas, arquitecturas).

    Es el UNICO tipo que aceptan las funciones de remuestreo. Una celda vacia (NaN)
    significa que esa tarea no tiene ejecuciones validas en esa arquitectura.
    """

    __slots__ = ('_valores', '_tareas', '_arquitecturas')

    def __init__(
        self, valores: np.ndarray, tareas: Sequence[str], arquitecturas: Sequence[str]
    ) -> None:
        valores = np.asarray(valores, dtype=float)
        if valores.ndim != 2:
            raise ValueError('La matriz de tareas debe tener dos dimensiones (tareas, arquitecturas)')
        if valores.shape != (len(tareas), len(arquitecturas)):
            raise ValueError(
                f'Forma {valores.shape} incompatible con {len(tareas)} tareas y '
                f'{len(arquitecturas)} arquitecturas'
            )
        repetidas = sorted({t for t in tareas if list(tareas).count(t) > 1})
        if repetidas:
            raise ValueError(
                f'Hay tareas repetidas en la matriz ({", ".join(repetidas[:5])}): parece una tabla '
                'de ejecuciones. Cada tarea debe aparecer UNA sola vez; agregue sus repeticiones.'
            )
        if len(set(arquitecturas)) != len(arquitecturas):
            raise ValueError('Hay arquitecturas repetidas en la matriz')
        if len(tareas) == 0:
            raise ValueError('La matriz no tiene tareas')
        valores.setflags(write=False)
        self._valores = valores
        self._tareas = tuple(tareas)
        self._arquitecturas = tuple(arquitecturas)

    @classmethod
    def desde_tabla(
        cls,
        tabla: pd.DataFrame,
        *,
        columna_tarea: str,
        columna_arquitectura: str,
        columna_valor: str,
        arquitecturas: Sequence[str],
    ) -> MatrizTareas:
        """Construye la matriz desde una tabla con UNA fila por (tarea, arquitectura).

        Falla si alguna pareja aparece mas de una vez: eso es una tabla de ejecuciones.
        """
        claves = tabla[[columna_tarea, columna_arquitectura]]
        duplicadas = claves[claves.duplicated(keep=False)]
        if not duplicadas.empty:
            ejemplo = duplicadas.iloc[0]
            raise ValueError(
                f'La tabla tiene {len(duplicadas)} filas repetidas por (tarea, arquitectura), por '
                f'ejemplo ({ejemplo[columna_tarea]}, {ejemplo[columna_arquitectura]}): es una tabla '
                'de ejecuciones, no de tareas. Agregue las repeticiones de cada tarea antes de '
                'remuestrear; el tamano de muestra es el numero de tareas.'
            )
        ancha = tabla.pivot(index=columna_tarea, columns=columna_arquitectura, values=columna_valor)
        ancha = ancha.reindex(columns=list(arquitecturas)).sort_index()
        return cls(ancha.to_numpy(dtype=float), [str(t) for t in ancha.index], arquitecturas)

    @property
    def valores(self) -> np.ndarray:
        return self._valores

    @property
    def tareas(self) -> tuple[str, ...]:
        return self._tareas

    @property
    def arquitecturas(self) -> tuple[str, ...]:
        return self._arquitecturas

    @property
    def n_tareas(self) -> int:
        return len(self._tareas)

    def indice(self, arquitectura: str) -> int:
        return self._arquitecturas.index(arquitectura)

    def seleccionar_tareas(self, tareas: Sequence[str]) -> MatrizTareas:
        """Submatriz con las tareas pedidas (por ejemplo, las de una categoria)."""
        posiciones = [self._tareas.index(t) for t in sorted(tareas) if t in self._tareas]
        return MatrizTareas(self._valores[posiciones], [self._tareas[p] for p in posiciones], self._arquitecturas)


def _exigir_matriz(matriz: object) -> MatrizTareas:
    if not isinstance(matriz, MatrizTareas):
        raise TypeError(_MENSAJE_NO_MATRIZ.format(tipo=type(matriz).__name__))
    return matriz


def _agregador(nombre: str) -> Callable[..., np.ndarray]:
    if nombre not in AGREGADORES:
        raise ValueError(f'Agregacion desconocida "{nombre}"; use {sorted(AGREGADORES)}')
    return AGREGADORES[nombre]


def indices_remuestreo(n_tareas: int, configuracion: ConfiguracionBootstrap) -> np.ndarray:
    """Indices de tareas remuestreadas con reemplazo: forma (replicas, n_tareas).

    Con la misma semilla y el mismo numero de tareas, los indices son identicos: todas las
    metricas de una corrida comparten las mismas replicas.
    """
    generador = np.random.default_rng(configuracion.semilla)
    return generador.integers(0, n_tareas, size=(configuracion.replicas, n_tareas))


def _intervalo(replicas: np.ndarray, nivel: float) -> Intervalo | None:
    validas = replicas[~np.isnan(replicas)]
    if validas.size == 0:
        return None
    cola = (1 - nivel) / 2
    inferior, superior = np.quantile(validas, [cola, 1 - cola])
    return Intervalo(float(inferior), float(superior), nivel)


def _sin_advertencias_de_nan(funcion: Callable[[], np.ndarray]) -> np.ndarray:
    # Una replica puede caer solo en tareas sin dato; su NaN se descarta al calcular el intervalo.
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)
        return funcion()


def bootstrap_por_arquitectura(
    matriz: MatrizTareas, agregacion: str, configuracion: ConfiguracionBootstrap
) -> dict[str, Estimacion]:
    """Estimacion e intervalo de cada arquitectura remuestreando tareas completas."""
    matriz = _exigir_matriz(matriz)
    agregar = _agregador(agregacion)
    valores = matriz.valores
    puntual = _sin_advertencias_de_nan(lambda: agregar(valores, axis=0))
    indices = indices_remuestreo(matriz.n_tareas, configuracion)
    # valores[indices] tiene forma (replicas, tareas, arquitecturas): cada fila elegida viaja entera.
    replicas = _sin_advertencias_de_nan(lambda: agregar(valores[indices], axis=1))
    resultado: dict[str, Estimacion] = {}
    for posicion, arquitectura in enumerate(matriz.arquitecturas):
        n_tareas = int(np.count_nonzero(~np.isnan(valores[:, posicion])))
        valor = None if n_tareas == 0 else float(puntual[posicion])
        intervalo = None if n_tareas == 0 else _intervalo(replicas[:, posicion], configuracion.nivel)
        resultado[arquitectura] = Estimacion(valor, intervalo, n_tareas)
    return resultado


def bootstrap_contraste(
    matriz: MatrizTareas,
    minuendo: str,
    sustraendo: str,
    agregacion: str,
    configuracion: ConfiguracionBootstrap,
) -> Estimacion:
    """Diferencia pareada: agrega (minuendo - sustraendo) calculada DENTRO de cada tarea.

    Con `media` es P(minuendo) - P(sustraendo); con `mediana` es la mediana de las
    diferencias por tarea. Las tareas sin dato en alguna de las dos quedan fuera.
    """
    matriz = _exigir_matriz(matriz)
    agregar = _agregador(agregacion)
    diferencias = matriz.valores[:, matriz.indice(minuendo)] - matriz.valores[:, matriz.indice(sustraendo)]
    n_tareas = int(np.count_nonzero(~np.isnan(diferencias)))
    if n_tareas == 0:
        return Estimacion(None, None, 0)
    puntual = float(_sin_advertencias_de_nan(lambda: agregar(diferencias)))
    indices = indices_remuestreo(matriz.n_tareas, configuracion)
    replicas = _sin_advertencias_de_nan(lambda: agregar(diferencias[indices], axis=1))
    return Estimacion(puntual, _intervalo(replicas, configuracion.nivel), n_tareas)
