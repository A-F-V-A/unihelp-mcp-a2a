# Resultados: las cuatro arquitecturas en una misma corrida (25 de septiembre de 2026)

Primera corrida con B0, B1, B2 y B3 en la **misma matriz**, que es lo que exigen
los contrastes pareados por tarea del cuaderno (H1: `B1 - B0`; H3: `B3 - B2`).
Es una corrida de **desarrollo**, no la oficial: una repeticion, tarifa sin
fijar y prompt del orquestador en su primera version (decision 44).

| Dato                    | Valor                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corrida                 | `experiment/corridas/cuatro-arquitecturas-r1` (artefactos copiados a `experiment/resultados/2026-09-25-cuatro-arquitecturas-r1/`; no se versionan) |
| Codigo                  | `1fea73b8e556` (arbol limpio)                                                                                                                      |
| Modelo                  | `gpt-5.5-2026-04-23`, esfuerzo `none`, temperatura 0,2, modo `record`                                                                              |
| Prompt                  | base 1.4.0; orquestador 1.0.0 y especialistas 1.0.0 (`docs/prompt-diffs.md`)                                                                       |
| Matriz                  | 40 tareas x 4 arquitecturas x 1 repeticion = 160 ejecuciones, orden aleatorio con semilla 20260922                                                 |
| Trazas                  | 160 validas, 0 en cuarentena, 0 fallos de infraestructura; M7.1 = 1,0 y M7.2 = 1,0                                                                 |
| Residuo de orquestacion | ningun rechazo ni aviso (umbral 15 %); la descomposicion es aditiva en las 160                                                                     |
| Duracion                | 27 minutos de reloj para las 160 ejecuciones                                                                                                       |

Todo lo que sigue sale de `resultados.json` del cuaderno; ninguna cifra se
calculo a mano (RM-02). Los intervalos son bootstrap pareado por tarea al 95 %
con 10 000 replicas (n = 40 tareas, RM-03). Se presentan como estimacion e
intervalo, no como aprobado/reprobado (RM-14).

## 1. Efectividad (M1.1, compuerta automatica)

| Arquitectura | Exito         | IC 95 %        | Tareas que no superan la compuerta                    |
| ------------ | ------------- | -------------- | ----------------------------------------------------- |
| B0           | 35/40 = 0,875 | [0,775; 0,975] | T-COM-004, T-COM-005, T-COM-009, T-INF-005, T-INF-010 |
| B1           | 37/40 = 0,925 | [0,825; 1,000] | T-COM-009, T-INF-005, T-INF-010                       |
| B2           | 37/40 = 0,925 | [0,825; 1,000] | T-COM-009, T-INF-002, T-INF-010                       |
| B3           | 38/40 = 0,950 | [0,875; 1,000] | T-COM-009, T-INF-010                                  |

Contrastes (mediana de la diferencia por tarea): `B1 - B0` = +0,050
[0,000; 0,125]; `B2 - B1` = 0,000 [-0,075; 0,075]; `B3 - B2` = +0,025
[0,000; 0,075]; `B3 - B1` = +0,025 [0,000; 0,075]. Todos los intervalos tocan
o incluyen el cero: con una repeticion no se puede afirmar que ninguna
arquitectura sea mas efectiva que otra. Las corridas anteriores de B0 dieron
33 a 36 de 40 con el mismo prompt: el ruido entre corridas es de unas tres
tareas (`apps/b0-directo/docs/RESULTADOS-B0-2026-09-24-gpt-5.5.md`).

Por categoria (M1.2): diagnostico y adversarial 10/10 en las cuatro;
informativa 8/10 en B0, B1 y B2 y 9/10 en B3; compuesta 7/10 en B0 y 9/10 en
B1, B2 y B3.

Motivos de la compuerta:

- **T-COM-009** y **T-INF-010** fallan en las cuatro (`falta_politica_requerida`
  POL-AV-002 y POL-CI-001): son las dos tareas con decision pendiente del
  equipo (P2 y P1 de `RESULTADOS-B0-2026-09-24-gpt-5.5.md`, seccion 4). No
  dependen de la arquitectura.
- **T-INF-005** (B0 y B1): `politica_prohibida` POL-MA-001 y `cifra_no_recuperada`
  11; ya conocida en B0.
- **T-COM-004** y **T-COM-005** (solo B0): `politica_prohibida` POL-MA-001 y
  POL-AV-003. En la corrida anterior de B0 pasaban: entran en el ruido.
- **T-INF-002** (solo B2): `politica_prohibida` POL-MA-002 (el especialista de
  conocimiento devolvio la politica extemporanea junto con la ordinaria y el
  orquestador la cito).

## 2. Latencia (M4.1 y M4.2)

Mediana entre tareas, en milisegundos:

| Componente             | B0     | B1     | B2     | B3     |
| ---------------------- | ------ | ------ | ------ | ------ |
| Total (M4.1)           | 5 688  | 5 541  | 11 230 | 11 352 |
| Modelo                 | 5 671  | 5 492  | 11 182 | 11 303 |
| Herramienta            | 14,2   | 19,6   | 24,5   | 22,7   |
| Transporte             | 0,009  | 11,9   | 9,6    | 12,9   |
| Orquestacion (residuo) | 4,2    | 3,8    | 7,1    | 6,7    |
| Proporcion del residuo | 0,07 % | 0,07 % | 0,07 % | 0,07 % |
| p95 de las ejecuciones | 13 051 | 13 167 | 23 147 | 23 817 |

Contrastes del total (mediana de diferencias por tarea):

| Contraste | Que aisla                                     | Diferencia    | IC 95 %          |
| --------- | --------------------------------------------- | ------------- | ---------------- |
| `B1 - B0` | Protocolo MCP (H1)                            | -116 ms       | [-259; +167]     |
| `B2 - B1` | Coordinacion multiagente                      | **+5 170 ms** | [+3 473; +5 745] |
| `B3 - B2` | Transporte A2A (H3)                           | +198 ms       | [-82; +548]      |
| `B3 - B1` | Multiagente distribuido frente a agente unico | **+5 662 ms** | [+4 161; +5 952] |

Lectura:

- **MCP no cuesta latencia medible** de extremo a extremo: `B1 - B0` incluye el
  cero. En el componente de transporte si se ve: +11,9 ms por ejecucion
  [5,7; 18,9], el costo de Streamable HTTP frente a la llamada en proceso.
- **El costo del multiagente es el modelo, no la red.** `B2 - B1` suma 5,2 s por
  tarea, y casi toda la diferencia esta en el componente modelo (+5 161 ms):
  el orquestador y los especialistas hacen 7 llamadas al modelo por ejecucion
  frente a 3 del agente unico (M4.4, tabla de abajo). El transporte de B2 no
  difiere del de B1 (0,0 ms [-3,0; 0,0]).
- **A2A frente a en proceso** (`B3 - B2`): +198 ms en el total, con un intervalo
  que incluye el cero; en el componente de transporte, +0,5 ms [0,0; 2,4]. El
  salto por red entre agentes es del orden del milisegundo por delegacion
  (`a2a.hops[].transport_ms` entre 0,2 y 25 ms en las trazas); lo que domina
  el total sigue siendo el modelo.

## 3. Llamadas al modelo, mensajes y tokens (M4.4, M4.5, M4.6)

| Metrica (mediana entre tareas)          | B0      | B1      | B2        | B3        |
| --------------------------------------- | ------- | ------- | --------- | --------- |
| Llamadas al modelo por ejecucion        | 3       | 3       | 7         | 7         |
| Mensajes entre agentes                  | 0       | 0       | 4         | 4         |
| Tokens por ejecucion (entrada + salida) | 16 587  | 16 538  | 24 582    | 25 061    |
| Tokens de entrada                       | 16 205  | 16 225  | 23 893    | 24 273    |
| Tokens de salida                        | 325     | 313     | 629       | 656       |
| Tokens totales de la corrida            | 786 443 | 771 369 | 1 067 180 | 1 078 077 |

Contrastes de tokens: `B1 - B0` = -15 [-36; +2]; `B2 - B1` = **+7 832**
[+5 028; +8 383]; `B3 - B2` = +14 [+1; +24]. El umbral de M4.5 (mensajes
iguales en B2 y B3) se cumple: la comparacion de latencia entre ambas aisla el
transporte.

## 4. Que no incluye esta corrida

- M4.3 (piso de latencia del transporte) queda `sin_datos`: no hay
  microbenchmark de transporte.
- M4.7 (costo) vale cero porque la tarifa sigue sin fijar (`corrida.yaml`,
  RM-17).
- Una sola repeticion: los contrastes de efectividad no distinguen diferencias
  menores de dos o tres tareas. La corrida oficial pide varias repeticiones.
- Juez LLM y validacion humana (M7.4, M7.5): no ejecutados.
- El prompt del orquestador es su primera version; no se ajusto tras esta
  corrida, y cualquier ajuste debe seguir siendo un delta sobre el base
  (decision 44), nunca por tarea.

## 5. Como reproducir

```bash
pnpm conocimiento:db && pnpm conocimiento:preparar && pnpm tickets:migrar
pnpm nx run-many -t build --projects=mcp-server,b0-directo,b1-mcp-agente,b2-multiagente-local,b3-a2a-conocimiento,b3-a2a-diagnostico,b3-a2a-orquestador
# arrancar los siete con `node dist/apps/<app>/main.js`, cada uno con su .env y UNIHELP_PERFIL=experimento
cd experiment
uv run python -m ejecutor correr --arquitecturas B0,B1,B2,B3 --nombre cuatro-arquitecturas-r1
uv run papermill analisis.ipynb salidas/analisis.cuatro-arquitecturas-r1.ipynb --cwd . \
  -p directorio_corrida corridas/cuatro-arquitecturas-r1 -p directorio_salidas salidas/cuatro-arquitecturas-r1
```
