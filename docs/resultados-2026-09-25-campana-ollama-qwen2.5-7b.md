# Resultados: campaña con el modelo local (Ollama, Qwen2.5 7B), cuatro arquitecturas, tres repeticiones (25 de septiembre de 2026)

El mismo experimento que la campaña de modelos de OpenAI
(`resultados-2026-09-25-campana-modelos.md`) con el proveedor local de la
decision 46: mismo prompt base, mismas herramientas, mismas 40 tareas, misma
compuerta y mismo ejecutor; solo cambia el modelo que responde. Las cifras
locales son **una campaña aparte**: no se comparan con las de OpenAI sin una
decision de medicion (RM-17; un 7B cuantizado no es equivalente a gpt-5.5).
Los contrastes entre arquitecturas dentro de esta campaña si son validos.

| Dato            | Valor                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Carpeta         | `experiment/resultados/2026-09-25-campana-unihelp-qwen2-5-7b-instruct-q4_K_M-ctx16k-r3/` (versionada, decision 47)                |
| Modelo          | `unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k` (Qwen2.5 7B Instruct, cuantizacion q4_K_M, contexto 16 384; `infra/ollama/Modelfile`) |
| Servidor        | Ollama 0.34.4 local, RTX 5060 Laptop 8 GB, sin `reasoning_effort`, temperatura 0,2, modo `record`                                 |
| Codigo          | `96fb3d15a61d` (con `campana.py` y prompts iguales a la campaña de OpenAI)                                                        |
| Matriz          | 40 tareas x 4 arquitecturas x 3 repeticiones = 480 ejecuciones, en el entorno aislado `c1`, una sola campaña (una GPU)            |
| Trazas          | 480 validas, 0 en cuarentena, 0 rechazos del residuo (3 avisos de residuo alto), M7.1 = 1,0 y M7.2 = 1,0                          |
| Estados finales | B0: 119 ok, 1 timeout · B1: 119 ok, 1 timeout · B2: 116 ok, 4 timeout · B3: 116 ok, 2 timeout, 2 limite de herramientas           |
| Duracion        | 97 minutos; 10,0 M tokens (1,5 M en B0, 1,5 M en B1, 3,7 M en B2, 3,3 M en B3), sin costo de API                                  |

Todo sale del `resultados.json` del cuaderno (RM-02); intervalos bootstrap
pareado por tarea al 95 % (n = 40 tareas), como estimacion e intervalo (RM-14).

## 1. Efectividad

**M1.1 · exito medio** (%, 120 ejecuciones por arquitectura), **M1.3 · exito
consistente** (pasa las 3 repeticiones) y **M1.4 · resultado mixto**:

| Metrica          | B0                | B1                | B2                | B3                |
| ---------------- | ----------------- | ----------------- | ----------------- | ----------------- |
| M1.1 exito medio | 55,8 [42,5; 69,2] | 53,3 [40,0; 67,5] | 32,5 [20,0; 45,8] | 34,2 [20,8; 48,3] |
| M1.3 consistente | 42,5 [27,5; 57,5] | 42,5 [27,5; 57,5] | 22,5 [10,0; 35,0] | 25,0 [12,5; 40,0] |
| M1.4 mixto       | 27,5 [15,0; 42,5] | 22,5 [10,0; 35,0] | 20,0 [10,0; 32,5] | 17,5 [7,5; 30,0]  |

**M1.2 · por categoria** (% medio):

| Categoria   | B0  | B1  | B2  | B3  |
| ----------- | --- | --- | --- | --- |
| informativa | 50  | 53  | 13  | 10  |
| diagnostico | 83  | 83  | 40  | 60  |
| compuesta   | 23  | 20  | 10  | 10  |
| adversarial | 67  | 57  | 67  | 57  |

**Contrastes de M1.1** (puntos porcentuales, mediana de la diferencia por
tarea): `B1 − B0` = 0 [−10; +10]; `B2 − B1` = **−20 [−30; −10]**; `B3 − B2` = 0
[−10; +10]; `B3 − B1` = **−20 [−30; −10]**.

Lectura:

- Con el 7B local el agente unico resuelve poco mas de la mitad de las tareas
  (56 %) y una de cada cuatro cambia de resultado entre repeticiones. Es el
  techo del modelo con este prompt, no de la arquitectura: MCP (B1) no cambia
  nada respecto a B0, igual que con los modelos de OpenAI.
- **El multiagente pierde 20 puntos** y esta vez el intervalo excluye el
  cero. B2 y B3 son indistinguibles entre si, asi que la perdida es de la
  coordinacion, no del transporte.
- Las tareas compuestas quedan casi fuera del alcance del modelo (10–23 %) y
  las informativas caen del 50 % al 10–13 % en B2/B3.

## 2. Por que falla el modelo local

Los motivos de la compuerta muestran un patron distinto al de los modelos
pequeños de OpenAI (que fallaban por proponer tickets de mas). Aqui el modelo
**no llega a hacer las llamadas que la tarea exige**:

- `falta_herramienta_obligatoria` domina en todas las arquitecturas y
  categorias: en las compuestas, 56 (B0), 55 (B1), 67 (B2) y 63 (B3) de 30
  ejecuciones x varias herramientas; el agente no propone el ticket
  (`tickets_creados: 0 esperaba 1` en 13–14 casos por arquitectura) o no
  consulta el estado.
- En B2 y B3 se suma `falta_politica_requerida` (24–25 casos en informativas y
  otros tantos en compuestas): el orquestador local a menudo no delega en
  `knowledge_lookup` o el especialista devuelve `sin_resultados`, y en
  diagnostico deja de delegar en `incident_diagnosis` (`falta_herramienta_obligatoria`
  15–20). Dicho de otro modo: con dos saltos de razonamiento (decidir delegar
  y luego buscar) el 7B se queda a mitad de camino con mas frecuencia que con
  uno (buscar directo).
- `cifra_no_recuperada` (2–9 por celda): el modelo afirma plazos o cifras que
  no estan en ningun extracto recuperado.
- Diez tareas fallan en las 12 ejecuciones (4 arquitecturas x 3
  repeticiones): T-ADV-003, T-COM-001, T-COM-002, T-COM-003, T-COM-004,
  T-COM-005, T-COM-009, T-COM-010, T-INF-002 y T-INF-010. Con gpt-5.5 solo
  fallaban asi T-COM-009 y T-INF-010.

Nada de esto es un defecto del codigo: las herramientas devolvieron lo mismo
que con OpenAI (misma base, mismo `mcp-server`) y las trazas validan al 100 %.
Es el resultado del modelo ante el mismo prompt, que la decision 46 pide no
ajustar por modelo.

## 3. Latencia (M4.1 y M4.2, mediana por tarea, ms)

| Componente             | B0                   | B1                   | B2                   | B3                    |
| ---------------------- | -------------------- | -------------------- | -------------------- | --------------------- |
| Total (M4.1)           | 5 518 [4 892; 6 321] | 5 349 [4 435; 6 435] | 8 419 [4 884; 9 471] | 8 781 [6 051; 10 074] |
| Modelo                 | 5 508                | 5 318                | 8 400                | 8 762                 |
| Herramienta            | 9,0                  | 19,4                 | 7,3                  | 11,6                  |
| Transporte             | 0,0                  | 3,7                  | 2,1                  | 4,5                   |
| Orquestacion (residuo) | 1,7                  | 1,7                  | 2,4                  | 2,6                   |
| p95 de las ejecuciones | 9 535                | 10 888               | 25 006               | 26 359                |

Contrastes del total: `B1 − B0` = +87 [−176; +323]; `B2 − B1` = **+1 642**
[+286; +3 723]; `B3 − B2` = +108 [−235; +812]; `B3 − B1` = +2 188 [+1 134;
+3 624]. Transporte: `B1 − B0` = +3,7 ms [+2,1; +4,0]; `B3 − B2` = +0,1 ms
[0,0; +2,5].

Un 7B en una GPU de portatil tarda lo mismo por tarea que gpt-5.5 en la nube
(5,5 s en B0), pero con la mitad de llamadas: 2 por ejecucion frente a 3 (M4.4),
porque a menudo responde sin consultar. El sobrecosto del multiagente es menor
que con OpenAI (+1,6 s frente a +4,7 a +6,2 s) por la misma razon: el
orquestador local hace 4 llamadas, no 7, y 2 mensajes entre agentes, no 4
(M4.5, umbral B2 = B3 cumplido). MCP y A2A cuestan milisegundos, como con
OpenAI.

## 4. Tokens (M4.6)

|                                      | B0               | B1               | B2               | B3               |
| ------------------------------------ | ---------------- | ---------------- | ---------------- | ---------------- |
| Total por ejecucion (mediana)        | 12 334           | 12 244           | 15 788           | 15 912           |
| Tokens de entrada en cache (mediana) | 11 310 de 11 937 | 11 313 de 11 928 | 14 749 de 15 261 | 14 756 de 15 305 |

Contrastes: `B1 − B0` = 0 [−15; +27]; `B2 − B1` = +3 203 [+300; +3 725];
`B3 − B2` = +7 [−13; +81]. Ollama reutiliza el prefijo del prompt en su cache
KV: el 95 % de los tokens de entrada llegan cacheados. Eso no cambia lo que se
mide (los tokens se cuentan igual), pero explica por que la latencia local es
comparable a la de la nube pese a la GPU modesta.

## 5. Lo que esta campaña no incluye

Tarifa (no aplica: sin costo de API; M4.7 = 0), microbenchmark de transporte
(M4.3 `sin_datos`), juez y validacion humana. Tres ejecuciones dejaron aviso de
residuo de orquestacion alto (proporcion > 15 %), sin rechazo. Los casetes de
esta campaña estan en `experiment/casetes/unihelp-qwen2-5-7b-instruct-q4_K_M-ctx16k/`
(no versionados) y permiten reproducirla en modo `replay`.

## 6. Como reproducir

```bash
pnpm ollama:crear          # construye el modelo desde infra/ollama/Modelfile (una vez)
cd experiment
uv run python campana.py --proveedor ollama --modelos unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k --repeticiones 3
```

Requiere Ollama en marcha, PostgreSQL con la base `unihelp_c1` migrada y los
siete backends compilados (`nx build`). Guia de instalacion y requisitos en
`docs/modelo-local-ollama.md`.
