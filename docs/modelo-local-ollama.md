# Modelo local con Ollama: instalación, requisitos y recomendaciones

Este documento explica cómo instalar Ollama, qué máquina hace falta como mínimo
para correr el experimento con un modelo local, cómo conectarlo a las cuatro
arquitecturas y qué precauciones tomar al interpretar sus cifras. Le sirve a
quien quiera repetir las 40 tareas sin gastar presupuesto de API y a quien
evalúe el trabajo de grado y necesite reproducirlo en su propio equipo. La
decisión que lo respalda es la 46 de
[`decisiones-tecnicas.md`](decisiones-tecnicas.md).

**Regla de partida:** el prompt base, las herramientas, el conjunto de tareas y
el ejecutor no cambian. Lo único que cambia es el modelo que responde. El
experimento evalúa **los mismos tests con distintos modelos**; el modelo local
es uno más de esos modelos, no una variante del sistema.

---

## 1. Qué es Ollama y por qué sirve aquí

Ollama es un servidor que ejecuta modelos abiertos (Qwen, Llama, Mistral, etc.)
en la máquina local y los expone por una API compatible con la de OpenAI
(`/v1/chat/completions`), incluido el _function calling_. El cliente del
modelo de `libs/agente-nucleo` ya habla esa API, así que el backend solo
necesita saber que el proveedor es `ollama` y a qué URL apuntar. Ninguna de las
cuatro arquitecturas (B0 a B3) cambia de código para usarlo.

```text
   backend (B0..B3) ──── Chat Completions + tools ────► http://localhost:11434/v1  (Ollama)
                                                          └── modelo local en la GPU
```

## 2. Requisitos mínimos de la máquina

El modelo de referencia es `qwen2.5:7b-instruct-q4_K_M` (7,6 mil millones de
parámetros, cuantizado a 4 bits, 4,7 GB en disco). Con él se validó el
procedimiento de este documento.

| Recurso           | Mínimo para correr                             | Recomendado                                          | Por qué                                                                                                                                                           |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GPU               | 8 GB de VRAM (NVIDIA con CUDA o AMD con ROCm)  | 12 GB o más                                          | El modelo (4,7 GB) más la caché de contexto de 16k tokens (unos 0,9 GB) deben caber enteros en la GPU; si se desborda a RAM la latencia se multiplica por 5 o más |
| RAM               | 16 GB                                          | 32 GB                                                | Sin GPU el modelo corre en CPU y necesita la misma memoria en RAM; con GPU, 16 GB dejan espacio para PostgreSQL, los siete backends y el ejecutor                 |
| CPU               | 8 núcleos                                      | 12 o más                                             | Solo relevante sin GPU; en ese caso una tarea tarda minutos, no segundos                                                                                          |
| Disco             | 10 GB libres                                   | 20 GB                                                | 4,7 GB del modelo base, el derivado (comparte capas), casetes y trazas de las corridas                                                                            |
| Sistema operativo | Windows 10/11, macOS 12+, Linux x86_64 o ARM64 | Cualquiera con controladores de GPU al día           | Ollama publica instaladores para los tres                                                                                                                         |
| Ollama            | 0.34 o superior                                | La versión con la que se construyó el modelo (ver 4) | Versiones anteriores no reportan `cached_tokens` ni aceptan todos los parámetros que envía el cliente                                                             |

Máquina en la que se validó: Intel Core i7-14700HX, 16 GB de RAM, NVIDIA
GeForce RTX 5060 Laptop con 8 GB de VRAM, Windows 11. Con esa configuración una
tarea del conjunto tarda entre 4 y 15 segundos (mediana 5,4 s) y la GPU queda
casi llena: **no corras dos modelos locales a la vez en una GPU de 8 GB.**

Sin GPU se puede correr, pero solo para comprobar que todo funciona: la
latencia deja de ser comparable con nada y RNF-04 (120 s por conversación)
puede agotarse en las tareas de varios turnos.

## 3. Instalación de Ollama

### Windows

```powershell
winget install --id Ollama.Ollama -e
```

El instalador deja un servicio en segundo plano (icono en la bandeja) que
escucha en `http://localhost:11434`. Comprobar:

```powershell
ollama --version
Invoke-WebRequest http://localhost:11434/api/version
```

Si `ollama` no se encuentra en una terminal abierta antes de instalar, ciérrala
y abre otra: el instalador agrega `%LOCALAPPDATA%\Programs\Ollama` al `PATH`.

### macOS

```bash
brew install ollama        # o el instalador de https://ollama.com/download
ollama serve &             # si no se instaló como aplicación
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
systemctl status ollama    # el instalador lo registra como servicio
```

En Linux con NVIDIA hace falta el controlador propietario y CUDA; el instalador
lo detecta y lo informa. Sin GPU reconocida, Ollama arranca igual en CPU.

## 4. Construir el modelo del experimento

El experimento no usa la etiqueta genérica `qwen2.5:7b-instruct` sino un modelo
derivado con dos garantías (RNF-08): una **cuantización fija** (`q4_K_M`), para
que el identificador señale siempre el mismo artefacto, y una **ventana de
contexto de 16 384 tokens**, porque la ventana por defecto de Ollama (4096)
truncaría el prompt base y los esquemas de las cinco herramientas sin avisar. La
receta está en [`../infra/ollama/Modelfile`](../infra/ollama/Modelfile).

```bash
pnpm ollama:crear           # descarga la base (4,7 GB) y construye el derivado
ollama list                 # debe aparecer unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k
ollama show unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k   # Capabilities: completion, tools; num_ctx 16384
```

Digest instalado al validar este documento (Ollama 0.34.4): base
`845dbda0ea48`, derivado `ea2acca68908`. Anota los tuyos en la corrida: si
cambian, el modelo no es el mismo.

Prueba rápida de que el modelo emite llamadas a herramienta:

```bash
curl http://localhost:11434/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k",
  "messages": [{"role": "user", "content": "¿Está funcionando el correo institucional?"}],
  "tools": [{"type": "function", "function": {"name": "consultar_estado_servicio",
    "parameters": {"type": "object", "properties": {"servicio": {"type": "string"}}, "required": ["servicio"]}}}]
}'
```

La respuesta debe traer `finish_reason: "tool_calls"`. La primera petición
tarda más (carga el modelo en la GPU, unos 30 s); las siguientes, segundos.

## 5. Conectar el proyecto

En el `.env` de cada backend que vaya a correr (B0, B1, B2 y los tres de B3),
reemplaza el bloque del modelo por:

```text
UNIHELP_MODELO_PROVEEDOR=ollama
UNIHELP_MODELO_ID=unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k
# UNIHELP_MODELO_URL_BASE=http://localhost:11434/v1   # valor por defecto; cambiar solo si Ollama está en otra máquina
```

`OPENAI_API_KEY` deja de ser obligatoria: Ollama no autentica. Todo lo demás
(temperatura 0,2, `top_p` 1, 2048 tokens de salida, sin paralelismo de
herramientas, modo `record`/`replay`, límites de RNF-04) se lee igual y queda
registrado en cada traza con `model.provider: ollama`.

En la pantalla **Configuración → Modelo de IA** del frontend el proveedor
disponible pasa a ser "Agente local"; los demás aparecen como no integrados.

## 6. Correr las pruebas

Con PostgreSQL arriba y las bases migradas y sembradas (ver `README.md` raíz):

```bash
# Una arquitectura, desde experiment/ (B0 en :3000 ya levantado con el .env de arriba)
uv run python -m ejecutor salud --arquitecturas B0
uv run python -m ejecutor correr --arquitecturas B0 --tareas T-COM-001 --nombre ollama-humo   # humo
uv run python -m ejecutor correr --arquitecturas B0 --repeticiones 1 --nombre ollama-b0-r1    # las 40

# Las cuatro arquitecturas en la misma matriz, con entorno aislado (bases unihelp_c1 migradas)
uv run python campana.py --proveedor ollama --modelos unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k --repeticiones 1

# Cuaderno de métricas sobre una corrida
uv run papermill analisis.ipynb salidas/analisis.ollama-b0-r1.ipynb --cwd . \
  -p directorio_corrida corridas/ollama-b0-r1 -p directorio_salidas salidas/ollama-b0-r1
```

Los casetes del modelo local se graban en `experiment/casetes/<modelo>`; un
casete de OpenAI no reproduce una corrida local ni al revés, porque la clave del
casete incluye el identificador del modelo.

## 7. Recomendaciones

1. **Una campaña a la vez.** `campana.py` puede lanzar varios modelos en
   paralelo porque con OpenAI la latencia se mide en el proveedor; con Ollama
   dos modelos se turnan la GPU y sus latencias se contaminan. Pasa un solo
   modelo por invocación.
2. **Nada pesado en la máquina durante la corrida.** Compilaciones, `pnpm verify`
   o un navegador con muchas pestañas compiten por CPU y RAM y mueven las
   cifras de M4. Compila antes, corre después.
3. **Cierra otros programas que usen la GPU** (juegos, editores de video,
   otros modelos). Si Ollama no cabe en VRAM, reparte capas a la CPU sin
   avisar y la latencia se dispara; `ollama ps` muestra el reparto
   (`100% GPU` es lo esperado).
4. **Mantén el servicio corriendo.** Ollama descarga el modelo de la GPU tras
   cinco minutos sin peticiones; la siguiente tarea paga la carga (unos 30 s)
   y aparece como un pico en M4. En una corrida seguida no ocurre; entre
   corridas, haz una petición de calentamiento o fija `OLLAMA_KEEP_ALIVE=-1`.
5. **Cambia de modelo solo por el Modelfile.** Si quieres probar otro
   (`llama3.1:8b`, `qwen3:8b`, `mistral-nemo:12b`), crea otro derivado con la
   misma `num_ctx` y una cuantización fija; el modelo debe declarar la
   capacidad `tools` en `ollama show`. Un modelo con modo de razonamiento
   (Qwen3, DeepSeek-R1) gasta tokens de pensamiento que no existen en los
   modelos de OpenAI comparados; desactívalo o no lo uses.
6. **No toques el prompt para el modelo local.** Si un modelo pequeño falla por
   no llamar una herramienta, eso es un resultado del experimento, no un
   defecto a corregir. Cambiar el prompt por modelo rompe la regla de que todos
   los modelos ven exactamente los mismos tests.
7. **Anota versión de Ollama y digest del modelo** en el documento de
   resultados de cada corrida, junto con la GPU. Son lo que hace reproducible
   una cifra local.

## 8. Cómo leer las cifras de un modelo local

- **Son una campaña aparte.** Un modelo de 7 mil millones de parámetros no es
  comparable con `gpt-5.5`; sus tasas de éxito, tokens y latencias se reportan
  en su propia tabla y no se promedian ni se contrastan con las de OpenAI sin
  una decisión de medición registrada (RM-17).
- **Los contrastes entre arquitecturas dentro de la campaña sí valen** (B1-B0,
  B2-B1, B3-B2): las cuatro miden con el mismo modelo local, el mismo prompt
  y la misma matriz.
- **La latencia es de tu GPU, no del proveedor.** Cambia de máquina y cambia la
  cifra; por eso se anota el hardware.
- **`cached_input_tokens` no es cero.** Ollama reutiliza el prefijo del prompt
  en su caché KV y lo reporta; tampoco se puede desactivar por petición, así
  que la decisión D2 sigue pendiente igual que con OpenAI (decisión 23).
- **El costo es cero de verdad**, pero el manifiesto sigue declarando
  `tarifa_configurada: false` para que nadie lea el cero como una tarifa medida.

## 9. Primera corrida de referencia (B0, 25 de septiembre de 2026)

Corrida `ollama-b0-qwen2.5-7b-r1`, una repetición, modo `record`, código
`dd09151f0540+sucio`, artefactos en
`experiment/resultados/2026-09-25-ollama-b0-qwen2.5-7b-r1/` (no versionados).

| Indicador                                  | Valor                     |
| ------------------------------------------ | ------------------------- |
| Trazas válidas / fallos de infraestructura | 40 / 0                    |
| Superan la compuerta automática            | 21 de 40                  |
| Por categoría (ADV / COM / DIA / INF)      | 7/10 · 3/10 · 9/10 · 2/10 |
| Latencia total por tarea, mediana / p90    | 5,4 s / 7,2 s             |
| Tokens de entrada por tarea, mediana       | 11 885 (11 309 en caché)  |
| Llamadas al modelo por tarea, mediana      | 2 (máximo 4)              |

Motivos de fallo más frecuentes: no invoca `buscar_politica` cuando la tarea lo
exige (26 casos) y anuncia la propuesta de ticket en vez de llamar
`proponer_ticket` (5 casos). Son comportamientos del modelo ante el mismo
prompt que cumplen los modelos de OpenAI; se registran, no se corrigen.

## 10. Solución de problemas

| Síntoma                                                                  | Causa probable                                            | Qué hacer                                                                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| El backend falla al arrancar con `UNIHELP_MODELO_PROVEEDOR` no soportado | Ejecutable compilado antes de la decisión 46              | `pnpm nx build <app>` y volver a arrancar                                                   |
| `Falla del proveedor del modelo: connect ECONNREFUSED 11434`             | Ollama no está corriendo                                  | Abrir la aplicación de Ollama o `ollama serve`                                              |
| `model "..." not found`                                                  | No se construyó el derivado                               | `pnpm ollama:crear`                                                                         |
| Respuestas que ignoran el sistema o cortan la conversación               | Ventana de contexto de 4096 (modelo base, no el derivado) | Usar `unihelp-qwen2.5:...-ctx16k`; verificar `num_ctx` con `ollama show`                    |
| Latencias de 60 s o más por turno                                        | Modelo repartido entre GPU y CPU                          | `ollama ps`; cerrar lo que use VRAM o bajar a un modelo más pequeño (`qwen2.5:3b-instruct`) |
| El modelo nunca emite `tool_calls`                                       | Modelo sin capacidad `tools`                              | Elegir uno que la declare en `ollama show`                                                  |
