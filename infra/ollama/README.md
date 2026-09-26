# infra/ollama — modelo local para el experimento

Ollama sirve un modelo local por la misma API de Chat Completions que usa el
cliente de `libs/agente-nucleo`, asi que las cuatro arquitecturas corren sin
tocar la variable medida: solo cambia el proveedor (decision 46).

| Archivo     | Que contiene                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `Modelfile` | Modelo derivado `unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k`: cuantizacion fija y `num_ctx 16384`. |

Guia completa (instalacion en cada sistema, requisitos minimos, recomendaciones y
solucion de problemas): [`docs/modelo-local-ollama.md`](../../docs/modelo-local-ollama.md).

## Uso

```bash
winget install Ollama.Ollama          # una vez; deja el servicio en http://localhost:11434
pnpm ollama:crear                     # descarga la base y construye el modelo derivado
```

En el `.env` de cada backend:

```text
UNIHELP_MODELO_PROVEEDOR=ollama
UNIHELP_MODELO_ID=unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k
# UNIHELP_MODELO_URL_BASE=http://localhost:11434/v1   (valor por defecto)
```

`OPENAI_API_KEY` no hace falta: Ollama no autentica. Las cifras obtenidas con
el modelo local se reportan como campaña aparte y no se mezclan con las de
OpenAI (RM-17, decision 46).
