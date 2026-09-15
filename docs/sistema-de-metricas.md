# Sistema de metricas

Describe como esta construido el componente que produce **todos** los numeros del
experimento: donde se valida una traza, donde se rechaza una ejecucion, como se
calcula e infiere cada metrica y que forma tiene `resultados.json`. Sirve a quien
instrumente un backend, a quien analice los datos y al equipo del panel web.

> Estado: infraestructura funcionando de extremo a extremo sobre una corrida
> **sintetica**. Familias M1, M4 y M7 implementadas; M2, M3, M5 y M6 declaradas en
> el registro y pendientes. Ningun backend produce trazas todavia.

La especificacion de cada metrica esta en [`09-plan-de-medicion.md`](09-plan-de-medicion.md);
este documento no la repite.

## 1. Regla de oro

**Ninguna metrica se calcula en TypeScript, ni en NestJS, ni en Angular** (RM-02,
decision 19). El backend produce trazas; el cuaderno de Python calcula; el panel lee
un archivo ya calculado. Si algo parece mas comodo de calcular en TypeScript, no se
hace: duplicar un calculo es exactamente el defecto que este diseno evita.

## 2. Flujo

```text
backend NestJS ──► libs/trazas (AJV) ──► trazas.jsonl            (valida)
                         └── invalida ──► cuarentena/*.json       (status esquema_invalido)

corrida/ ──► analisis/carga.py ──► salidas/intermedios/ejecuciones.parquet (solo validas)
              (esquema, tokens,         └─ intentos.parquet (todos, con motivos)
               residuo, huella,
               duplicados)
                                  ▼
metricas.yaml ──► analisis/registro.py ──► familias/m1, m4, m7 ──► inferencia.py
                                  ▼
                   analisis.ipynb (papermill) ──► salidas/resultados.json
                                                   salidas/tabla_N.csv, figura_N.svg
                                                   salidas/manifiesto.json
```

Directorio de una corrida (lo que lee la carga; nombres declarados en `metricas.yaml`):

| Archivo                         | Productor                     | Obligatorio |
| ------------------------------- | ----------------------------- | ----------- |
| `trazas.jsonl`                  | ejecutor via `libs/trazas`    | si          |
| `cuarentena/*.json`             | `libs/trazas`                 | no          |
| `puntuaciones.jsonl`            | compuerta + juez (futuro)     | para M1     |
| `huellas-esperadas.json`        | base de conocimiento (futuro) | para M7.2   |
| `bench-transport.json`          | microbenchmark (futuro)       | para M4.3   |
| `calificacion-humana.jsonl`     | revisores humanos             | para M7.4-5 |
| `veredictos-juez.jsonl`         | juez (futuro)                 | para M7.5   |
| `reproduccion/trazas.jsonl`     | reproduccion desde casetes    | para M7.6   |
| `control-instrumentacion.jsonl` | corrida de control            | para M7.7   |

Los formatos marcados `provisional` en el registro estan en
`experiment/schemas/insumos.schema.json` y se fijan cuando exista su productor.

## 3. Comandos

```bash
pnpm analisis:desde-cero  # uv sync + corrida sintetica + cuaderno completo
pnpm analisis             # solo el cuaderno (nx run analisis:ejecutar)
pnpm analisis:test        # pytest, incluidas dos ejecuciones del cuaderno
pnpm nx test trazas       # validador AJV, cuarentena y sincronia con el esquema
pnpm nx run trazas:generar  # regenerar tipos tras cambiar traza.schema.json
```

## 4. Registro de metricas

`experiment/metricas.yaml` tiene una entrada por metrica con los campos de la ficha
del plan (`codigo`, `familia`, `nombre`, `que_se_espera_medir`, `como_se_mide`,
`formula`, `unidad_y_direccion`, `fuente`, `unidad_observacion`, `unidad_analisis`,
`rol`, `hipotesis`, `tipo_valor_esperado`, `valor_umbral`, `que_no_captura`) mas un
bloque `implementacion`.

`fuente` es una lista de `{artefacto, campos: {alias: campo exacto}}`. El codigo de
calculo **solo conoce el alias** (`metrica.columna('latencia')`); el registro
traduce a `timing.total_ms`. Se verifica automaticamente:

- Todo campo de traza del registro existe en `traza.schema.json`.
- La tabla `estados_finales` cubre exactamente la lista cerrada de estados.
- Toda metrica `implementada` tiene funcion y toda funcion tiene ficha implementada.
- Ningun modulo de `analisis/` ni el cuaderno escribe una ruta de la traza; ninguna
  funcion de calculo escribe el nombre de un campo.
- `valor_umbral` existe si y solo si `tipo_valor_esperado` es `umbral`.

### Implementadas frente a declaradas

| Familia | Implementadas                            | Pendientes  |
| ------- | ---------------------------------------- | ----------- |
| M1      | M1.1, M1.2, M1.3, M1.4, M1.5             | —           |
| M2      | —                                        | M2.1 a M2.6 |
| M3      | —                                        | M3.1 a M3.6 |
| M4      | M4.1, M4.2, M4.3, M4.4, M4.5, M4.6, M4.7 | —           |
| M5      | —                                        | M5.1 a M5.7 |
| M6      | —                                        | M6.1 a M6.5 |
| M7      | M7.1, M7.2, M7.3, M7.4, M7.5, M7.6, M7.7 | —           |

19 implementadas y 24 pendientes (43 en total; 17 primarias, 7 de control). Una
implementada cuyo insumo no trae la corrida queda `sin_datos`, nunca en cero.

## 5. Donde se rechaza una ejecucion

| Punto                  | Motivo                          | Condicion                                                                                     | Efecto                                                   |
| ---------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `libs/trazas` (NestJS) | `esquema_invalido`              | No valida contra `traza.schema.json` (incluye tokens de entrada o llamadas al modelo en cero) | No se escribe en `trazas.jsonl`; sobre en `cuarentena/`  |
| Carga, lectura         | `json_malformado`               | La linea no es JSON                                                                           | Intento invalido                                         |
| Carga, esquema         | `esquema_invalido`              | Revalidacion con jsonschema, o sobre leido de `cuarentena/`                                   | Intento invalido                                         |
| Carga, consumo         | `sin_consumo_tokens`            | `input_tokens + output_tokens = 0`                                                            | Intento invalido                                         |
| Carga, residuo         | `residuo_orquestacion_negativo` | `total - (modelo + herramienta + transporte) < 0`                                             | Intento invalido: defecto de instrumentacion (HU-MET-07) |
| Carga, residuo         | `descomposicion_no_aditiva`     | El residuo reportado difiere del recalculado en mas de 1 ms                                   | Intento invalido                                         |
| Carga, estado inicial  | `estado_inicial_incorrecto`     | La huella no es la esperada para la tarea (si hay huellas)                                    | Intento invalido                                         |
| Carga, tarea           | `tarea_desconocida`             | No existe `docs/tasks/<task_id>.yaml`                                                         | Intento invalido                                         |
| Carga, duplicados      | `ejecucion_duplicada`           | Ya hubo un intento valido para (tarea, arquitectura, repeticion)                              | Intento invalido; los de infraestructura no cuentan      |
| Carga, aviso           | —                               | Residuo valido pero mayor al 15 % del total                                                   | Se conserva; aparece en `validacion.avisos_residuo`      |

Despues de la carga, la tabla `estados_finales` del registro decide que ejecucion
valida entra a cada calculo (plan, seccion 13):

| Estado                  | Efectividad | Latencia | Costo   |
| ----------------------- | ----------- | -------- | ------- |
| `ok`                    | incluye     | incluye  | incluye |
| `timeout`               | fallo       | excluye  | incluye |
| `limite_herramientas`   | fallo       | excluye  | incluye |
| `error_agente`          | fallo       | excluye  | incluye |
| `error_infraestructura` | excluye     | excluye  | excluye |
| `esquema_invalido`      | excluye     | excluye  | excluye |

Ademas, M1 no se calcula (queda `sin_datos`) si alguna ejecucion incluida en
efectividad no tiene puntuacion: no se completan ceros ni se reduce el denominador
en silencio.

## 6. Inferencia

`analisis/inferencia.py` implementa el bootstrap percentil pareado por conglomerados:
10 000 replicas, semilla 20261014 (en el registro), intervalo del 95 %.

- Solo acepta una `MatrizTareas` (una fila por tarea, una columna por arquitectura).
  Pasarle un `DataFrame` falla con `TypeError`; construirla con filas repetidas por
  (tarea, arquitectura) falla con `ValueError` ("es una tabla de ejecuciones").
- Remuestrea filas completas: al elegir una tarea arrastra sus cuatro arquitecturas.
- Los contrastes (`B1-B0`, `B2-B1`, `B3-B2`, `B3-B1`) agregan la diferencia calculada
  dentro de cada tarea. Estiman con intervalo; **no deciden** hipotesis.
- El tamano de muestra que se reporta es el numero de tareas.

## 7. Contrato `resultados.json`

Esquema: [`experiment/schemas/resultados.schema.json`](../experiment/schemas/resultados.schema.json),
version `1.0.0`. El cuaderno valida el documento antes de escribirlo. Es el **unico**
contrato con el panel.

```text
{
  version_esquema_resultados: "1.0.0"
  generado_en: ISO 8601            // unico campo que cambia entre ejecuciones
  corrida: {
    semilla, version_codigo, modelo_id, version_registro, version_esquema_traza,
    arquitecturas: [B0..B3],
    tareas: { total, por_categoria: {categoria: n} },
    ejecuciones: { intentadas, validas, invalidas, por_motivo: {motivo: n} },
    inferencia: { unidad: "tarea", tamano_muestra, metodo, replicas, nivel, semilla }
  }
  validacion: {
    umbral_aviso_residuo,
    avisos_residuo: [{ ejecucion, proporcion }],
    rechazos: [{ origen, ejecucion | null, motivos: [..], detalle: [..] }]
  }
  metricas: [{
    codigo, familia, nombre, rol, hipotesis, tipo_valor_esperado,
    unidad, direccion, unidad_analisis,
    estado: calculada | sin_datos | pendiente, motivo_estado,
    filas: [{ arquitectura | null, dimensiones: {..}, estadistico, valor | null,
              intervalo: {inferior, superior, nivel} | null, n_tareas, n_observaciones }],
    contrastes: [{ minuendo, sustraendo, dimensiones, estadistico, diferencia,
                   intervalo | null, n_tareas }],
    notas: [..],
    umbral: { operador, valor?, arquitecturas?, alcance?, descripcion,
              consecuencia?, observado, alcanza: bool | null }   // SOLO si tipo = umbral
  }]
}
```

Reglas para el panel:

- Una metrica `resultado_abierto` **no tiene** `umbral` ni ningun indicador de
  aprobado/reprobado; el esquema lo prohibe. Solo `tipo_valor_esperado = umbral`
  lleva `umbral.alcanza` (`null` si no se pudo evaluar).
- `corrida.inferencia.tamano_muestra` es el numero de tareas: es el que se muestra
  junto a los intervalos. `corrida.ejecuciones` son observaciones, nunca muestra.
- Las secundarias y descriptivas no sirven para afirmar que una arquitectura es mejor.
- `dimensiones` desglosa la fila (`categoria`, `componente`, `tokens`, `tipo_fallo`,
  `transporte`); `estadistico` dice que es el valor (`media_entre_tareas`,
  `mediana_entre_tareas`, `p95_ejecuciones`, `conteo`, `kappa_cohen`...).
- Si `version_esquema_resultados` no coincide con la que conoce, el panel lo declara
  y no muestra datos parciales (HU-MET-09).

## 8. Corrida sintetica

`experiment/fixtures/generador.py` genera 8 tareas (2 por categoria) x 4
arquitecturas x 5 repeticiones = 160 ejecuciones mas una reejecucion, con todos los
insumos. Sus numeros son inventados para ejercitar el codigo. Casos borde:

| Ejecucion         | Caso                                   | Se espera                                |
| ----------------- | -------------------------------------- | ---------------------------------------- |
| T-COM-002, B3, r2 | timeout                                | valida; fallo en M1.5; fuera de latencia |
| T-DIA-002, B1, r4 | 21 llamadas: limite de herramientas    | valida; fallo en M1.5                    |
| T-INF-001, B2, r3 | residuo de orquestacion negativo       | rechazada                                |
| T-ADV-001, B0, r1 | sin tokens registrados                 | rechazada (esquema y consumo)            |
| T-DIA-001, B3, r5 | error de infraestructura y reejecucion | M7.3 > 0; sin duplicado                  |
| T-INF-002, B3, r1 | residuo del 22 %                       | valida con aviso                         |
| T-COM-001, B2, r4 | reproduccion con respuesta distinta    | M7.6 < 1                                 |

## 9. Pendiente

- Familias M2, M3, M5 y M6, juez automatico, calificacion humana y panel web.
- Productores reales de los insumos provisionales; al fijarlos, cambiar
  `insumos.schema.json` y quitar `provisional` del registro.
- Tabla 3 (contrastes con decision por hipotesis), 5 y 6 del plan.
- Discrepancias con el anexo: tabla de la seccion 9 de [`AGENTS.md`](../AGENTS.md).
