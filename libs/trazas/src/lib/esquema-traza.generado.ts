/**
 * GENERADO desde experiment/schemas/traza.schema.json con `pnpm nx run trazas:generar`.
 * NO editar a mano: se cambia el esquema y se regenera en el mismo commit.
 */
import type { SchemaObject } from 'ajv';

export const ESQUEMA_TRAZA: SchemaObject = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:unihelp:esquema:traza:1.0.0",
  "title": "TrazaEjecucion",
  "description": "Traza de UNA ejecucion (tarea x arquitectura x repeticion). Fuente unica de los datos de las metricas: una traza que no valida contra este esquema no entra al conjunto oficial. Cualquier cambio exige subir version_esquema y regenerar los tipos de libs/trazas en el mismo commit (HU-MET-01).",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version_esquema",
    "run_id",
    "trace_id",
    "task_id",
    "condition",
    "repetition",
    "provenance",
    "timing",
    "usage",
    "tool_calls",
    "a2a",
    "outcome"
  ],
  "properties": {
    "version_esquema": {
      "description": "Version de este esquema con la que se produjo la traza.",
      "const": "1.0.0"
    },
    "run_id": {
      "description": "Identificador unico de la ejecucion. Ej.: T-COM-004|B3|r3|20261014T031102Z.",
      "type": "string",
      "minLength": 1
    },
    "trace_id": {
      "description": "Identificador de correlacion que viaja por los servicios y el registro de auditoria.",
      "type": "string",
      "minLength": 1
    },
    "task_id": {
      "description": "Tarea del conjunto de evaluacion (docs/tasks).",
      "type": "string",
      "pattern": "^T-(INF|DIA|COM|ADV)-[0-9]{3}$"
    },
    "condition": {
      "description": "Arquitectura que resolvio la ejecucion.",
      "enum": [
        "B0",
        "B1",
        "B2",
        "B3"
      ]
    },
    "repetition": {
      "description": "Repeticion de la tarea en la arquitectura, desde 1.",
      "type": "integer",
      "minimum": 1
    },
    "provenance": {
      "$ref": "#/$defs/procedencia"
    },
    "model": {
      "$ref": "#/$defs/modelo"
    },
    "timing": {
      "$ref": "#/$defs/tiempos"
    },
    "usage": {
      "$ref": "#/$defs/consumo"
    },
    "conversation": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/turno"
      }
    },
    "tool_calls": {
      "description": "Llamadas a herramienta en orden de emision. Arreglo vacio si no hubo ninguna.",
      "type": "array",
      "items": {
        "$ref": "#/$defs/llamadaHerramienta"
      }
    },
    "a2a": {
      "$ref": "#/$defs/mensajeriaAgentes"
    },
    "server_audit": {
      "description": "Eventos del registro de auditoria del servidor para este trace_id.",
      "type": "array",
      "items": {
        "$ref": "#/$defs/eventoAuditoria"
      }
    },
    "outcome": {
      "$ref": "#/$defs/resultado"
    },
    "errors": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/errorEjecucion"
      }
    }
  },
  "$comment": "if/then: B0 y B1 tienen un solo agente, no hay mensajes entre agentes por definicion (M4.5).",
  "if": {
    "type": "object",
    "properties": {
      "condition": {
        "enum": [
          "B0",
          "B1"
        ]
      }
    },
    "required": [
      "condition"
    ]
  },
  "then": {
    "type": "object",
    "properties": {
      "a2a": {
        "type": "object",
        "properties": {
          "mensajes_totales": {
            "const": 0
          }
        }
      }
    }
  },
  "$defs": {
    "duracionMs": {
      "description": "Duracion en milisegundos medida con reloj monotono (decision de medicion D6).",
      "type": "number",
      "minimum": 0
    },
    "procedencia": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "state_hash_inicial",
        "semilla",
        "version_codigo",
        "modelo_id"
      ],
      "properties": {
        "state_hash_inicial": {
          "description": "Huella del estado inicial devuelta por el restablecimiento (M7.2).",
          "type": "string",
          "pattern": "^sha256:[0-9a-f]{64}$"
        },
        "semilla": {
          "description": "Semilla de la corrida.",
          "type": "integer"
        },
        "version_codigo": {
          "description": "Commit del codigo que produjo la traza.",
          "type": "string",
          "minLength": 1
        },
        "modelo_id": {
          "description": "Identificador exacto del modelo, con fecha de snapshot.",
          "type": "string",
          "minLength": 1
        },
        "config_hash": {
          "type": "string"
        },
        "dataset_version": {
          "type": "string"
        },
        "prompt_hash": {
          "type": "string"
        },
        "docker_images": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "llm_mode": {
          "enum": [
            "record",
            "replay",
            "live"
          ]
        },
        "cassette_path": {
          "type": "string"
        }
      }
    },
    "modelo": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "provider": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "snapshot": {
          "type": "string"
        },
        "temperature": {
          "type": "number"
        },
        "top_p": {
          "type": "number"
        },
        "max_tokens": {
          "type": "integer"
        },
        "judge_model": {
          "type": [
            "string",
            "null"
          ]
        }
      }
    },
    "tiempos": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "total_ms",
        "breakdown"
      ],
      "properties": {
        "started_at": {
          "description": "Reloj de pared, solo para ordenar y auditar; ninguna duracion se calcula con el (D6). ISO 8601.",
          "type": "string",
          "format": "date-time"
        },
        "ended_at": {
          "description": "ISO 8601.",
          "type": "string",
          "format": "date-time"
        },
        "total_ms": {
          "description": "Latencia de extremo a extremo sin la espera de confirmacion (M4.1).",
          "$ref": "#/$defs/duracionMs"
        },
        "breakdown": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "llm_ms",
            "tool_exec_ms",
            "transport_ms",
            "orchestration_ms"
          ],
          "properties": {
            "llm_ms": {
              "$ref": "#/$defs/duracionMs"
            },
            "tool_exec_ms": {
              "$ref": "#/$defs/duracionMs"
            },
            "transport_ms": {
              "description": "Suma de rtt - duracion reportada por el receptor en cada salto (D5).",
              "$ref": "#/$defs/duracionMs"
            },
            "orchestration_ms": {
              "description": "Residuo reportado. El analisis lo recalcula y rechaza la ejecucion si el residuo real es negativo (HU-MET-07).",
              "$ref": "#/$defs/duracionMs"
            }
          }
        }
      }
    },
    "consumo": {
      "description": "Consumo del modelo sumado entre todos los agentes. Obligatorio y no nulo: una traza sin consumo de tokens es INVALIDA, no incompleta (HU-MET-01).",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "input_tokens",
        "output_tokens",
        "llm_calls",
        "cost_usd_est"
      ],
      "properties": {
        "input_tokens": {
          "type": "integer",
          "minimum": 1
        },
        "output_tokens": {
          "type": "integer",
          "minimum": 0
        },
        "cached_input_tokens": {
          "description": "Debe ser 0 en la corrida oficial (decision de medicion D2).",
          "type": "integer",
          "minimum": 0
        },
        "llm_calls": {
          "type": "integer",
          "minimum": 1
        },
        "cost_usd_est": {
          "description": "Costo estimado en dolares con la tarifa congelada en la configuracion (M4.7).",
          "type": "number",
          "minimum": 0
        }
      }
    },
    "turno": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "turno",
        "rol",
        "texto"
      ],
      "properties": {
        "turno": {
          "type": "integer",
          "minimum": 1
        },
        "rol": {
          "enum": [
            "usuario",
            "agente"
          ]
        },
        "texto": {
          "type": "string"
        }
      }
    },
    "llamadaHerramienta": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "seq",
        "nombre",
        "args",
        "isError",
        "resultado_status"
      ],
      "properties": {
        "seq": {
          "description": "Posicion en la secuencia de llamadas de la ejecucion, desde 1 (M2.4).",
          "type": "integer",
          "minimum": 1
        },
        "nombre": {
          "type": "string",
          "minLength": 1
        },
        "args": {
          "type": "object"
        },
        "isError": {
          "type": "boolean"
        },
        "resultado_status": {
          "description": "ok o el codigo de error de la herramienta (VALIDACION_ENTRADA, CONFIRMACION_REQUERIDA, ...).",
          "type": "string",
          "minLength": 1
        },
        "agente": {
          "type": "string"
        },
        "transporte": {
          "type": "string"
        },
        "resultado": {
          "description": "Contenido devuelto por la herramienta; lo usa la fidelidad de citacion (M3.1)."
        },
        "resultado_resumen": {
          "type": "object"
        },
        "latency_ms": {
          "$ref": "#/$defs/duracionMs"
        }
      }
    },
    "mensajeriaAgentes": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "mensajes_totales"
      ],
      "properties": {
        "mensajes_totales": {
          "description": "Mensajes entre agentes. Cero en B0 y B1; en B2 se cuentan las invocaciones en proceso equivalentes (M4.5).",
          "type": "integer",
          "minimum": 0
        },
        "task_id": {
          "type": "string"
        },
        "estados": {
          "type": "array",
          "items": {
            "type": "object"
          }
        },
        "hops": {
          "type": "array",
          "items": {
            "type": "object"
          }
        },
        "artefactos": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "eventoAuditoria": {
      "type": "object",
      "required": [
        "accion",
        "resultado"
      ],
      "properties": {
        "accion": {
          "type": "string"
        },
        "resultado": {
          "type": "string"
        }
      }
    },
    "resultado": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "final_answer",
        "confirmacion_solicitada",
        "tickets_creados"
      ],
      "properties": {
        "status": {
          "description": "Estado final. Lista cerrada: su tratamiento en efectividad, latencia y costo esta en experiment/metricas.yaml.",
          "enum": [
            "ok",
            "timeout",
            "limite_herramientas",
            "error_agente",
            "error_infraestructura",
            "esquema_invalido"
          ]
        },
        "final_answer": {
          "description": "Respuesta final entregada a la persona; null si la ejecucion no llego a responder.",
          "type": [
            "string",
            "null"
          ]
        },
        "final_json": {
          "type": [
            "object",
            "null"
          ]
        },
        "confirmacion_solicitada": {
          "type": "boolean"
        },
        "confirmacion_otorgada": {
          "type": [
            "boolean",
            "null"
          ]
        },
        "tickets_creados": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "rechazos_servidor": {
          "type": "array",
          "items": {
            "type": "object"
          }
        }
      }
    },
    "errorEjecucion": {
      "type": "object",
      "required": [
        "tipo",
        "mensaje"
      ],
      "properties": {
        "tipo": {
          "type": "string"
        },
        "mensaje": {
          "type": "string"
        }
      }
    }
  }
};
