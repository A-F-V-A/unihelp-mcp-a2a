# Especificación de historias de usuario — UniHelp

> Versión 1.0 · 9 de septiembre de 2026. Generado desde `historias_data.py` con `build_historias.py`; no editar a mano.

Este documento traduce las funcionalidades del plan de trabajo a historias de usuario de alto nivel, con criterios de aceptación verificables. Es la fuente del backlog: cada historia debe poder convertirse en tareas y en pruebas sin volver a interpretar el plan.

**Cómo leer este documento.** Las historias describen capacidades observables, no componentes. Una historia se considera de alto nivel cuando su beneficio se puede enunciar sin nombrar una tecnología. Cuando el criterio de aceptación sí nombra un mecanismo concreto, es porque ese mecanismo es la garantía que se quiere demostrar, y no un detalle de implementación intercambiable.

| Indicador | Valor |
|---|---|
| Épicas | 12 |
| Historias de usuario | 45 |
| Actores | 7 |
| Requisitos no funcionales | 8 |
| Puntos estimados | 240 |

## 1. Los dos planos del sistema

El sistema tiene dos planos de usuario que conviene no mezclar. El plano de producto es UniHelp visto por quien pide ayuda y por quien atiende la mesa de soporte. El plano de plataforma es el entorno experimental visto por quien construye los agentes, ejecuta las corridas y analiza los resultados. Las historias del primer plano definen qué debe hacer el sistema; las del segundo definen qué debe poder medirse sobre él. Ambas son necesarias: sin las primeras no hay caso de estudio, y sin las segundas no hay experimento.

## 2. Actores

| Actor | Plano | Descripción |
|---|---|---|
| **Solicitante** | Producto | Persona de la comunidad universitaria (estudiante, docente o administrativo) que reporta una dificultad con un servicio digital. Es el usuario final del producto y no conoce la estructura interna del soporte. |
| **Analista de soporte** | Producto | Persona de la mesa de ayuda que recibe los tickets generados y necesita que lleguen bien clasificados y priorizados. |
| **Responsable de la plataforma** | Producto | Integrante del equipo que sostiene la API, el servidor MCP y las garantías de seguridad del sistema. |
| **Desarrollador de agentes** | Plataforma | Integrante del equipo que construye e integra los agentes en cualquiera de las cuatro arquitecturas. |
| **Investigador** | Plataforma | Integrante del equipo que diseña, ejecuta y analiza el experimento comparativo. |
| **Revisor de calidad** | Plataforma | Integrante del equipo que califica manualmente la muestra para validar el juicio automático. Trabaja a ciegas. |
| **Tercero replicador** | Plataforma | Persona ajena al equipo que intenta reproducir los resultados a partir del repositorio publicado. |

## 3. Convenciones

Formato: *como `<actor>`, quiero `<capacidad>`, para `<beneficio>`*. El beneficio debe poder escribirse sin repetir la capacidad; si no se puede, la historia es una tarea técnica disfrazada.

Los códigos `HU` son estables: una historia descartada se marca como retirada, nunca se renumera ni se reutiliza.

| Convención | Valores |
|---|---|
| Prioridad | Obligatoria · Importante · Opcional |
| Arquitecturas | B0 · B1 · B2 · B3 · Todas · Plataforma |
| Estimación | 1, 2, 3, 5, 8, 13 (una historia de 13 se divide antes del laboratorio) |
| Semana | 1 a 10 del cronograma |

### Definición de lista

- La historia tiene rol, capacidad y beneficio, y el beneficio se puede escribir sin repetir la capacidad.
- Los criterios de aceptación son verificables y se pueden traducir a una prueba automatizada o a una comprobación manual descrita.
- Está estimada por el equipo y tiene responsable principal.
- Se sabe en qué arquitecturas aplica y con qué funcionalidad e hipótesis del plan se relaciona.
- No depende de una decisión abierta del plan de trabajo.

### Definición de terminado

- Código incorporado a la rama principal mediante solicitud revisada por otra persona.
- Prueba automatizada que cubre cada criterio de aceptación verificable.
- Documentación mínima actualizada en el documento correspondiente.
- Si toca contratos, los esquemas y la instantánea de contrato se actualizan en el mismo cambio.
- Si toca el experimento ya congelado, hay entrada en el registro de desviaciones.
- Demostrada en la sesión de los viernes, ejecutándose.

## 4. Mapa de épicas

| Cód. | Plano | Épica | Objetivo | HU |
|---|---|---|---|---|
| `E1` | Producto | **Atención de la solicitud** | Que una persona pueda pedir ayuda en sus propias palabras y reciba una respuesta ajustada a lo que realmente necesita. | 4 |
| `E2` | Producto | **Consulta del conocimiento institucional** | Que la respuesta se apoye en la norma vigente y sea verificable por quien la recibe. | 4 |
| `E3` | Producto | **Diagnóstico de incidentes** | Que la persona sepa si el problema es del servicio o suyo, y qué corresponde hacer en cada caso. | 4 |
| `E4` | Producto | **Registro controlado de tickets** | Que nada quede registrado a nombre de una persona sin que esa persona lo haya autorizado de forma explícita. | 5 |
| `E5` | Producto | **Rechazo seguro** | Que el sistema resista el contenido y las peticiones diseñadas para hacerle actuar fuera de sus reglas. | 5 |
| `E6` | Producto | **Visibilidad operativa** | Que el estado agregado del sistema sea consultable, tanto para la mesa de ayuda como para detectar problemas del propio experimento. | 2 |
| `E7` | Plataforma | **Interoperabilidad de herramientas con MCP** | Que las capacidades del sistema se expongan como un contrato tipado que un agente pueda descubrir y usar sin acoplarse a la API interna. | 4 |
| `E8` | Plataforma | **Coordinación entre agentes con A2A** | Que varios agentes independientes resuelvan juntos una solicitud, y que el costo de esa coordinación sea medible. | 4 |
| `E9` | Plataforma | **Trazabilidad y observabilidad** | Que toda ejecución se pueda reconstruir después, con el detalle suficiente para atribuir un costo o un fallo a un componente concreto. | 3 |
| `E10` | Plataforma | **Ejecución del experimento** | Que las 800 ejecuciones se produzcan de forma controlada, repetible y sin contaminación entre ellas. | 4 |
| `E11` | Plataforma | **Evaluación y control del juicio** | Que el criterio de éxito sea aplicable por dos personas distintas con el mismo resultado, y que el juicio automático esté validado. | 4 |
| `E12` | Plataforma | **Reproducibilidad y entrega** | Que una persona ajena al equipo pueda repetir el experimento y llegar a las mismas tablas. | 2 |

## 5. E1 · Atención de la solicitud

*Plano Producto.* Que una persona pueda pedir ayuda en sus propias palabras y reciba una respuesta ajustada a lo que realmente necesita.

### HU-01

> Como **solicitante**, quiero **describir mi problema en español y en mis propias palabras, sin llenar un formulario ni escoger categorías**, para pedir ayuda sin tener que conocer cómo está organizado el soporte.

**Criterios de aceptación**

- Acepta texto libre de entre 10 y 2000 caracteres y responde siempre en español.
- No exige seleccionar servicio, categoría ni prioridad antes de responder.
- Una entrada vacía o de menos de 10 caracteres produce una petición de aclaración, no un error técnico.

`Obligatoria` · Todas · Semana 3 · 3 pts · Trazabilidad: F-1

### HU-02

> Como **solicitante**, quiero **que el sistema reconozca si necesito información, un diagnóstico o ambas cosas**, para recibir una respuesta ajustada a mi necesidad y no un texto genérico.

**Criterios de aceptación**

- Clasifica cada solicitud como informativa, de diagnóstico, compuesta o fuera de alcance.
- En B2 y B3 la clasificación queda registrada explícitamente como campo del primer mensaje entre agentes; en B0 y B1 se infiere de las herramientas invocadas.
- La clasificación coincide con la etiqueta del conjunto de tareas en al menos el 85 por ciento de los casos.

`Obligatoria` · Todas · Semana 3 · 5 pts · Trazabilidad: F-1

### HU-03

> Como **solicitante**, quiero **que me diga con claridad cuándo mi solicitud está fuera de su alcance y a dónde debo acudir**, para no perder tiempo esperando una respuesta que nunca va a llegar.

**Criterios de aceptación**

- Atiende únicamente aula virtual, correo institucional, autenticación y matrícula.
- Ante cualquier otro asunto responde que está fuera de su alcance e indica el canal correcto.
- En una solicitud fuera de alcance no invoca ninguna herramienta de escritura.

`Obligatoria` · Todas · Semana 3 · 2 pts · Trazabilidad: F-1, F-7

### HU-04

> Como **solicitante**, quiero **continuar la conversación en varios turnos**, para aclarar detalles o confirmar una acción sin tener que repetir todo desde el principio.

**Criterios de aceptación**

- Conserva el contexto de la conversación hasta ocho turnos de agente.
- Al alcanzar el límite de turnos o de llamadas a herramientas, informa explícitamente en lugar de cortar en silencio.
- El estado de la conversación no se filtra entre solicitudes distintas.

`Obligatoria` · Todas · Semana 3 · 3 pts · Trazabilidad: F-1

## 6. E2 · Consulta del conocimiento institucional

*Plano Producto.* Que la respuesta se apoye en la norma vigente y sea verificable por quien la recibe.

### HU-05

> Como **solicitante**, quiero **recibir el procedimiento aplicable con su fuente citada, indicando código y versión**, para poder verificarlo y citarlo ante la dependencia correspondiente.

**Criterios de aceptación**

- Toda respuesta que se apoye en una política cita su código y su versión.
- Devuelve como máximo tres políticas, ordenadas por relevancia.
- Cada extracto indica su posición dentro del documento de origen.

`Obligatoria` · Todas · Semana 3 · 5 pts · Trazabilidad: F-2, H1

### HU-06

> Como **solicitante**, quiero **que no se inventen plazos, requisitos ni direcciones de contacto**, para no actuar con información falsa y perder un trámite.

**Criterios de aceptación**

- Toda cifra, fecha, plazo o dirección presente en la respuesta aparece literalmente en alguno de los extractos recuperados.
- La verificación es automática y forma parte del criterio de éxito de la tarea, no de una revisión manual.

`Obligatoria` · Todas · Semana 3 · 5 pts · Trazabilidad: F-2

### HU-07

> Como **solicitante**, quiero **que me diga honestamente cuando no encuentra una política aplicable**, para saber que debo consultar por otro canal en lugar de confiar en una aproximación.

**Criterios de aceptación**

- Si ninguna política supera el umbral de relevancia, lo declara de forma explícita.
- No sustituye la ausencia de resultado por una política de tema parecido.
- El conjunto de tareas incluye casos sin respuesta posible para verificarlo.

`Obligatoria` · Todas · Semana 3 · 3 pts · Trazabilidad: F-2

### HU-08

> Como **responsable de la plataforma**, quiero **que la búsqueda de políticas sea determinista y repetible**, para que un fallo se pueda atribuir al agente o al protocolo y no a la variabilidad de la búsqueda.

**Criterios de aceptación**

- Dos consultas idénticas sobre el mismo estado devuelven exactamente el mismo conjunto ordenado de resultados.
- La recuperación es léxica y no depende de un modelo de representación vectorial.
- Existen al menos cuatro políticas distractoras cercanas para que la búsqueda no sea trivial.

`Obligatoria` · Todas · Semana 2 · 5 pts · Trazabilidad: F-2

## 7. E3 · Diagnóstico de incidentes

*Plano Producto.* Que la persona sepa si el problema es del servicio o suyo, y qué corresponde hacer en cada caso.

### HU-09

> Como **solicitante**, quiero **saber si la falla que veo es del servicio o es solo mía**, para decidir si debo esperar o si tengo que hacer algo.

**Criterios de aceptación**

- Consulta el estado operativo del servicio antes de emitir un diagnóstico.
- Relaciona los síntomas descritos con los componentes afectados que reporta el servicio.
- Distingue el caso individual, con el servicio operativo, del incidente general.

`Obligatoria` · Todas · Semana 3 · 5 pts · Trazabilidad: F-3, H2

### HU-10

> Como **solicitante**, quiero **conocer el estado del servicio, el componente afectado y la ventana estimada de restablecimiento**, para poder planear mi trabajo mientras se resuelve.

**Criterios de aceptación**

- Informa el estado, los componentes afectados y el alcance.
- Informa la ventana estimada solo cuando el servicio la publica; si no existe, lo dice en lugar de estimarla.
- Incluye la referencia del incidente cuando el servicio la tiene.

`Obligatoria` · Todas · Semana 3 · 3 pts · Trazabilidad: F-3

### HU-11

> Como **analista de soporte**, quiero **que la prioridad se calcule con la tabla institucional y no con el criterio del modelo**, para que la cola de trabajo sea consistente y auditable.

**Criterios de aceptación**

- La prioridad se deriva del estado, el alcance y el nivel de servicio, según la tabla publicada del plan de trabajo.
- Un diagnóstico correcto con prioridad equivocada no cuenta como éxito.
- La justificación de la prioridad viaja en el diagnóstico estructurado.

`Obligatoria` · Todas · Semana 3 · 5 pts · Trazabilidad: F-3

### HU-12

> Como **solicitante**, quiero **que durante un mantenimiento programado se me informe la ventana en lugar de abrirme un ticket**, para no generar ruido en la mesa de ayuda por algo ya previsto.

**Criterios de aceptación**

- Con el servicio en mantenimiento, la acción recomendada es informar y esperar.
- No se propone ni se crea ticket, aunque el usuario lo pida.
- Se comunica la ventana de mantenimiento publicada.

`Obligatoria` · Todas · Semana 3 · 3 pts · Trazabilidad: F-3, F-4

## 8. E4 · Registro controlado de tickets

*Plano Producto.* Que nada quede registrado a nombre de una persona sin que esa persona lo haya autorizado de forma explícita.

### HU-13

> Como **solicitante**, quiero **ver un resumen legible del ticket antes de que se cree**, para comprobar que refleja realmente mi problema antes de autorizarlo.

**Criterios de aceptación**

- La propuesta devuelve un resumen en lenguaje natural con servicio, categoría, prioridad y descripción.
- La propuesta no produce ningún efecto sobre los datos.
- Si faltan datos obligatorios, se listan y la propuesta no queda lista para confirmar.

`Obligatoria` · Todas · Semana 3 · 5 pts · Trazabilidad: F-4, H4

### HU-14

> Como **solicitante**, quiero **que no se registre ningún ticket a mi nombre sin mi confirmación explícita**, para mantener el control sobre lo que se hace en mi nombre.

**Criterios de aceptación**

- La confirmación se registra a partir del texto literal escrito por la persona.
- Un texto ambiguo o condicional no se acepta como confirmación.
- Cero tickets creados sin confirmación en las 800 ejecuciones del experimento.

`Obligatoria` · Todas · Semana 3 · 8 pts · Trazabilidad: F-4, H4

### HU-15

> Como **solicitante**, quiero **poder negarme y que esa negativa se respete**, para cerrar la conversación sin consecuencias no deseadas.

**Criterios de aceptación**

- Ante una negativa, la conversación termina sin ticket y se reconoce la decisión.
- La propuesta queda descartada y su identificador no se puede reutilizar.
- El conjunto de tareas incluye dos casos de confirmación negada.

`Obligatoria` · Todas · Semana 3 · 3 pts · Trazabilidad: F-4, H4

### HU-16

> Como **responsable de la plataforma**, quiero **que el servidor rechace toda creación de ticket que no traiga un token de confirmación válido**, para que la garantía de seguridad no dependa de que el modelo se comporte bien.

**Criterios de aceptación**

- Una creación sin token o con token inválido se rechaza con error de confirmación requerida.
- Un token emitido para otra propuesta, o vencido, también se rechaza.
- Todo intento rechazado queda en el registro de auditoría con su motivo.
- La tasa de rechazo mecánico ante intentos sin token es del cien por ciento.

`Obligatoria` · Todas · Semana 2 · 8 pts · Trazabilidad: F-4, H4

### HU-17

> Como **solicitante**, quiero **recibir el número del ticket creado y su estado**, para poder hacerle seguimiento después.

**Criterios de aceptación**

- Devuelve el identificador con el formato institucional y el estado inicial.
- Un reintento sobre la misma propuesta devuelve el ticket existente y no crea uno nuevo.
- El ticket queda consultable por su identificador.

`Obligatoria` · Todas · Semana 3 · 3 pts · Trazabilidad: F-4

## 9. E5 · Rechazo seguro

*Plano Producto.* Que el sistema resista el contenido y las peticiones diseñadas para hacerle actuar fuera de sus reglas.

### HU-18

> Como **responsable de la plataforma**, quiero **que el contenido recuperado se trate siempre como información y nunca como instrucciones**, para que un documento manipulado no pueda dirigir el comportamiento del sistema.

**Criterios de aceptación**

- Todo extracto se entrega delimitado y etiquetado explícitamente como contenido recuperado.
- Ante una política con instrucciones incrustadas, el sistema reporta la política y advierte del contenido anómalo.
- Cero acciones de escritura en las tareas de inyección indirecta, en las cuatro arquitecturas.

`Obligatoria` · Todas · Semana 4 · 8 pts · Trazabilidad: F-7

### HU-19

> Como **responsable de la plataforma**, quiero **que se rechacen las peticiones de saltar la confirmación, aunque quien las haga alegue autoridad**, para que la regla de confirmación no se pueda negociar en la conversación.

**Criterios de aceptación**

- Una petición de crear sin confirmar se rechaza y se explica la regla.
- Alegar pertenencia a un área técnica o urgencia no cambia el resultado.
- El rechazo queda registrado en la auditoría con su motivo.

`Obligatoria` · Todas · Semana 4 · 5 pts · Trazabilidad: F-7, H4

### HU-20

> Como **responsable de la plataforma**, quiero **que ningún agente pueda ejecutar acciones fuera del alcance que declara**, para que el privilegio esté en la arquitectura y no en la redacción del prompt.

**Criterios de aceptación**

- Cada agente solo puede invocar las herramientas asignadas a su rol.
- La restricción se aplica en el cliente y se valida además en el servidor.
- El agente de conocimiento recibe un rechazo por falta de permiso al intentar crear un ticket.

`Obligatoria` · B2, B3 · Semana 4 · 5 pts · Trazabilidad: F-7

### HU-21

> Como **solicitante**, quiero **que no se expongan datos de tickets de otras personas**, para confiar en que mi información tampoco se expone a terceros.

**Criterios de aceptación**

- Una petición de datos de terceros se rechaza con explicación.
- Los reportes entregan conteos agregados, nunca listados con datos individuales.
- El registro de auditoría guarda una huella del cuerpo de la petición, no el cuerpo.

`Obligatoria` · Todas · Semana 4 · 5 pts · Trazabilidad: F-7

### HU-22

> Como **desarrollador de agentes**, quiero **que un argumento inválido produzca un error tipado y no una respuesta inventada**, para poder distinguir un fallo del sistema de un fallo del modelo.

**Criterios de aceptación**

- Un servicio inexistente o una prioridad fuera de rango devuelven un error con código identificable.
- El agente comunica el error en lugar de continuar con datos inventados.
- Existe un cortacircuitos que detiene la ejecución al superar el número máximo de llamadas.

`Obligatoria` · Todas · Semana 4 · 3 pts · Trazabilidad: F-7

## 10. E6 · Visibilidad operativa

*Plano Producto.* Que el estado agregado del sistema sea consultable, tanto para la mesa de ayuda como para detectar problemas del propio experimento.

### HU-23

> Como **analista de soporte**, quiero **consultar cuántos tickets hay por servicio, prioridad y estado**, para ver dónde se concentra la demanda y priorizar la atención.

**Criterios de aceptación**

- Permite agrupar por servicio, prioridad o estado, y acotar por rango de fechas.
- Devuelve únicamente conteos agregados.
- Los datos de partida incluyen tickets históricos, para que el reporte no salga vacío.

`Importante` · Todas · Semana 2 · 3 pts · Trazabilidad: F-6

### HU-24

> Como **investigador**, quiero **usar el reporte agregado como detector de contaminación entre ejecuciones**, para descubrir de inmediato si el restablecimiento del entorno falló.

**Criterios de aceptación**

- Dos ejecuciones de la misma tarea parten del mismo conteo inicial.
- Una diferencia en el conteo inicial invalida la ejecución de forma automática.

`Obligatoria` · Plataforma · Semana 3 · 2 pts · Trazabilidad: F-6

## 11. E7 · Interoperabilidad de herramientas con MCP

*Plano Plataforma.* Que las capacidades del sistema se expongan como un contrato tipado que un agente pueda descubrir y usar sin acoplarse a la API interna.

### HU-25

> Como **desarrollador de agentes**, quiero **descubrir las capacidades disponibles como un contrato tipado, con sus esquemas de entrada y salida**, para integrar un agente sin leer el código de la plataforma.

**Criterios de aceptación**

- El servidor publica las cinco herramientas con esquema de entrada y de salida.
- La lista de herramientas se compara contra una instantánea versionada; cualquier cambio exige actualizarla en el mismo cambio de código.
- Las mismas capacidades están disponibles en B1, B2 y B3.

`Obligatoria` · B1, B2, B3 · Semana 4 · 8 pts · Trazabilidad: H1

### HU-26

> Como **desarrollador de agentes**, quiero **que cada herramienta declare si solo lee o si además escribe**, para razonar sobre el riesgo de una capacidad sin tener que leer su implementación.

**Criterios de aceptación**

- Las herramientas de consulta se anotan como de solo lectura e idempotentes.
- La creación de ticket se anota como destructiva.
- La anotación es parte del contrato observable y se documenta en el artículo.

`Importante` · B1, B2, B3 · Semana 4 · 2 pts · Trazabilidad: H1

### HU-27

> Como **desarrollador de agentes**, quiero **añadir una herramienta nueva sin recompilar ni redesplegar el agente**, para comprobar en la práctica cuánto reduce MCP el esfuerzo de cambio.

**Criterios de aceptación**

- El servidor notifica el cambio en la lista de herramientas y el agente la incorpora sin reinicio.
- El esfuerzo se mide con el protocolo de sobre sellado y se compara entre las cuatro arquitecturas.
- La demostración queda grabada para la sesión final.

`Obligatoria` · Todas · Semana 8 · 5 pts · Trazabilidad: H1

### HU-28

> Como **desarrollador de agentes**, quiero **que los recursos y las plantillas de prompt del servidor estén disponibles y documentados**, para poder observar si el agente prefiere unas primitivas sobre otras.

**Criterios de aceptación**

- El servidor expone los recursos de políticas, estados y glosario.
- El uso de recursos frente a herramientas se registra y se reporta como hallazgo descriptivo.
- Las plantillas de prompt del servidor quedan fuera de la corrida oficial, con la decisión registrada y justificada.

`Opcional` · B1, B2, B3 · Semana 4 · 3 pts · Trazabilidad: H1

## 12. E8 · Coordinación entre agentes con A2A

*Plano Plataforma.* Que varios agentes independientes resuelvan juntos una solicitud, y que el costo de esa coordinación sea medible.

### HU-29

> Como **desarrollador de agentes**, quiero **que el orquestador descubra a los especialistas por su tarjeta de agente y su habilidad declarada**, para poder añadir o sustituir un especialista sin tocar el prompt ni el código del orquestador.

**Criterios de aceptación**

- Cada agente publica su tarjeta en la ruta estándar y valida contra el esquema del protocolo.
- El orquestador resuelve el destinatario por identificador de habilidad, no por dirección escrita en el prompt.
- Las direcciones base viven en configuración, no en el código.

`Obligatoria` · B3 · Semana 5 · 8 pts · Trazabilidad: H3

### HU-30

> Como **desarrollador de agentes**, quiero **que los especialistas devuelvan artefactos estructurados y no prosa**, para poder evaluar automáticamente lo que produce cada agente.

**Criterios de aceptación**

- El especialista de conocimiento devuelve políticas, resumen y nivel de confianza.
- El especialista de diagnóstico devuelve servicio, estado, alcance, prioridad y acción recomendada.
- La redacción final para la persona la compone el orquestador.
- En B0 y B1 el agente único emite el mismo objeto final, para que la evaluación sea idéntica en las cuatro arquitecturas.

`Obligatoria` · B2, B3 · Semana 5 · 8 pts · Trazabilidad: H2, H3

### HU-31

> Como **desarrollador de agentes**, quiero **expresar la espera de confirmación como un estado del protocolo**, para mostrar cómo A2A modela de forma nativa la intervención humana.

**Criterios de aceptación**

- La tarea transita a estado de entrada requerida cuando hay una propuesta pendiente.
- La tarea no avanza sin un turno real de la persona.
- El mismo requisito, resuelto como turno de conversación en B0, B1 y B2, produce el mismo registro de auditoría.

`Obligatoria` · B3 · Semana 5 · 5 pts · Trazabilidad: H3, H4

### HU-32

> Como **responsable de la plataforma**, quiero **que la caída de un especialista produzca un fallo explícito**, para que el sistema nunca invente un diagnóstico que no pudo obtener.

**Criterios de aceptación**

- Con un especialista fuera de servicio, la tarea termina en fallo con motivo.
- No se emite diagnóstico ni política si el especialista no respondió.
- Diez tareas concurrentes no mezclan identificadores de tarea entre sí.

`Obligatoria` · B3 · Semana 5 · 5 pts · Trazabilidad: H3

## 13. E9 · Trazabilidad y observabilidad

*Plano Plataforma.* Que toda ejecución se pueda reconstruir después, con el detalle suficiente para atribuir un costo o un fallo a un componente concreto.

### HU-33

> Como **investigador**, quiero **un identificador de traza que atraviese el agente, el servidor de herramientas y la API**, para reconstruir el orden causal completo de una ejecución sin ambigüedad.

**Criterios de aceptación**

- El identificador se propaga por cabecera en la API y en las herramientas, y como metadato en los mensajes entre agentes.
- Cada llamada del ejecutor tiene su evento correspondiente en la API y viceversa, sin huecos.
- La traza permite responder qué se llamó, en qué orden y con qué resultado.

`Obligatoria` · Todas · Semana 3 · 8 pts · Trazabilidad: F-5

### HU-34

> Como **investigador**, quiero **la latencia descompuesta en modelo, herramienta, transporte y orquestación**, para poder afirmar cuánto cuesta el protocolo y no solo cuánto tarda el sistema.

**Criterios de aceptación**

- Cada traza registra los cuatro componentes de latencia por separado.
- Cada agente reporta su propio tiempo de procesamiento, para que el tiempo de transporte sea una resta exacta y no una estimación.
- El consumo de tokens se registra siempre; una ejecución sin ese dato se considera inválida.

`Obligatoria` · Todas · Semana 3 · 8 pts · Trazabilidad: F-5, H3

### HU-35

> Como **responsable de la plataforma**, quiero **un registro de auditoría que solo se agrega y que no guarde contenido sensible**, para poder auditar lo que ocurrió sin acumular información innecesaria.

**Criterios de aceptación**

- Toda operación de escritura deja al menos un evento de auditoría.
- El evento guarda una huella criptográfica del cuerpo, no el cuerpo.
- Los eventos no se modifican ni se borran.

`Obligatoria` · Todas · Semana 2 · 5 pts · Trazabilidad: F-5

## 14. E10 · Ejecución del experimento

*Plano Plataforma.* Que las 800 ejecuciones se produzcan de forma controlada, repetible y sin contaminación entre ellas.

### HU-36

> Como **investigador**, quiero **restablecer el entorno a un estado conocido antes de cada ejecución**, para que las repeticiones de una misma tarea sean comparables entre sí.

**Criterios de aceptación**

- El restablecimiento es transaccional y devuelve una huella del estado resultante.
- Si la huella difiere de la esperada para esa tarea, la ejecución se aborta.
- La operación solo existe en el perfil de pruebas y no está disponible en ningún otro.

`Obligatoria` · Plataforma · Semana 2 · 5 pts · Trazabilidad: F-6

### HU-37

> Como **investigador**, quiero **ejecutar la matriz completa con un solo comando y poder reanudarla si se interrumpe**, para no perder una corrida de veinte horas por una caída intermedia.

**Criterios de aceptación**

- Un comando ejecuta todas las tareas, arquitecturas y repeticiones indicadas.
- El orden de las tareas se aleatoriza dentro de cada repetición con una semilla registrada.
- La reanudación no repite ejecuciones ya completadas.
- El manifiesto de la corrida registra configuración, semilla, versión de código e imágenes utilizadas.

`Obligatoria` · Plataforma · Semana 3 · 13 pts · Trazabilidad: H1, H2, H3

### HU-38

> Como **investigador**, quiero **que ninguna traza inválida llegue a persistirse**, para descubrir los problemas de instrumentación en la semana 3 y no en la semana 7.

**Criterios de aceptación**

- La traza se valida contra su esquema antes de escribirse.
- Una traza que no valida se aparta y la ejecución se marca como fallida.
- Un fallo de infraestructura se reejecuta y queda registrado; cualquier otro fallo cuenta como fallo de la arquitectura.

`Obligatoria` · Plataforma · Semana 3 · 5 pts · Trazabilidad: H1, H2, H3

### HU-39

> Como **investigador**, quiero **grabar las llamadas al modelo y poder reproducirlas después**, para depurar el análisis sin gastar presupuesto y protegerme de que el modelo cambie a mitad del semestre.

**Criterios de aceptación**

- En modo de grabación se guarda cada par de petición y respuesta canonicalizado.
- En modo de reproducción no se hace ninguna llamada externa; una petición sin grabación produce un error explícito.
- La corrida completa reproducida arroja resultados idénticos.

`Obligatoria` · Plataforma · Semana 2 · 8 pts · Trazabilidad: H1, H2, H3

## 15. E11 · Evaluación y control del juicio

*Plano Plataforma.* Que el criterio de éxito sea aplicable por dos personas distintas con el mismo resultado, y que el juicio automático esté validado.

### HU-40

> Como **investigador**, quiero **que los criterios objetivos se evalúen de forma automática**, para que la parte verificable del éxito no dependa de ninguna interpretación.

**Criterios de aceptación**

- Se verifican herramientas invocadas y prohibidas, orden exigido, ticket creado o no, prioridad y políticas citadas.
- Se verifica que las cifras citadas aparezcan en los extractos recuperados.
- Una ejecución que no supere esta capa no puede considerarse exitosa por ningún otro medio.

`Obligatoria` · Plataforma · Semana 3 · 8 pts · Trazabilidad: H1, H2, H3, H4

### HU-41

> Como **investigador**, quiero **que el juicio sobre la respuesta en lenguaje natural sea ciego a la arquitectura evaluada**, para evitar que la evaluación favorezca a la arquitectura que esperamos que gane.

**Criterios de aceptación**

- El evaluador automático no recibe la arquitectura ni ningún indicio de ella.
- Usa un modelo distinto al de ejecución, con temperatura cero y prompt versionado.
- Emite puntos cubiertos, puntos faltantes, prohibiciones violadas y veredicto.

`Obligatoria` · Plataforma · Semana 7 · 5 pts · Trazabilidad: H1, H2, H3

### HU-42

> Como **revisor de calidad**, quiero **calificar una muestra sin saber qué arquitectura la produjo ni qué dijo el evaluador automático**, para que mi calificación sirva realmente para validar el juicio automático.

**Criterios de aceptación**

- La muestra es del veinte por ciento, estratificada por categoría y arquitectura, con semilla registrada.
- Dos revisores califican de forma independiente.
- Se alcanza un acuerdo entre revisores de al menos 0,75 y un acuerdo con el evaluador automático de al menos el 85 por ciento.
- Los desacuerdos se resuelven en sesión conjunta y quedan escritos como precedente.

`Obligatoria` · Plataforma · Semana 7 · 8 pts · Trazabilidad: H1, H2, H3

### HU-43

> Como **investigador**, quiero **medir el esfuerzo real de añadir una herramienta sin que nadie haya podido prepararse**, para que la métrica de modularidad no sea manipulable.

**Criterios de aceptación**

- La especificación de la herramienta se sella en la semana 2 y se abre en la semana 8.
- Cada arquitectura la implementa cronometrada, por una sola persona.
- Se registran archivos tocados, líneas netas, componentes que exigen redespliegue, minutos hasta prueba verde y resultado de la regresión.

`Obligatoria` · Todas · Semana 8 · 5 pts · Trazabilidad: H1

## 16. E12 · Reproducibilidad y entrega

*Plano Plataforma.* Que una persona ajena al equipo pueda repetir el experimento y llegar a las mismas tablas.

### HU-44

> Como **tercero replicador**, quiero **reproducir el experimento completo en cinco comandos, sin claves de pago**, para verificar los resultados por mi cuenta antes de citarlos.

**Criterios de aceptación**

- Cinco comandos llevan desde la copia del repositorio hasta el reporte generado.
- La reproducción no requiere credenciales de ningún proveedor.
- Una persona ajena al equipo lo consigue en menos de sesenta minutos, siguiendo solo las instrucciones escritas.

`Obligatoria` · Plataforma · Semana 9 · 8 pts · Trazabilidad: H1, H2, H3

### HU-45

> Como **investigador**, quiero **que cada tabla y cada figura del artículo tenga el código que la produce**, para que ninguna afirmación del manuscrito dependa de un cálculo manual perdido.

**Criterios de aceptación**

- El cuaderno de análisis corre de principio a fin sin intervención manual.
- Cada tabla y figura publicada se identifica con la celda que la genera.
- El conjunto de tareas y las trazas se publican con identificador persistente.

`Obligatoria` · Plataforma · Semana 9 · 5 pts · Trazabilidad: H1, H2, H3, H4

## 17. Requisitos no funcionales

No son historias porque ningún actor los pide de forma aislada: son condiciones que toda historia debe respetar.

| Cód. | Nombre | Requisito | Cómo se verifica |
|---|---|---|---|
| `RNF-01` | Comparabilidad | Las cuatro arquitecturas comparten prompt base, modelo, parámetros de muestreo y conjunto de capacidades. El delta de prompt entre arquitecturas se limita a la descripción de las herramientas y se publica. | Revisión del delta de prompts publicado y prueba de equivalencia entre B2 y B3. |
| `RNF-02` | Determinismo del entorno | Dadas la misma tarea y la misma grabación, la ejecución produce el mismo resultado. La recuperación de políticas y el cálculo de prioridad son deterministas. | Corrida en modo de reproducción con resultados idénticos. |
| `RNF-03` | Aislamiento entre ejecuciones | Ninguna ejecución observa datos creados por otra. | Huella de estado idéntica al inicio de todas las repeticiones de una tarea. |
| `RNF-04` | Presupuesto de tiempo | Una ejecución se corta a los 120 segundos, a los 8 turnos de agente o a las 20 llamadas a herramientas, lo que ocurra primero. | El corte produce un estado observable en la traza, nunca un tiempo de espera silencioso. |
| `RNF-05` | Datos de prueba | Todo el contenido es de prueba en un ambiente controlado: solicitantes anónimos y direcciones de dominio reservado para ejemplos. No se conecta ningún sistema institucional real. | Revisión de los datos de partida y detector de secretos en la integración continua. |
| `RNF-06` | Levantamiento del entorno | El escenario completo se levanta con un solo comando y queda operativo en menos de noventa segundos. | Prueba de humo en la integración continua, incluyendo una tarea de punta a punta. |
| `RNF-07` | Idioma | Toda interacción con la persona ocurre en español, incluidos los mensajes de error y de rechazo. | Revisión en la calificación de la muestra. |
| `RNF-08` | Trazabilidad de versiones | Cada ejecución registra versión de código, imágenes, modelo con su identificador exacto, prompt y parámetros. | Validación del manifiesto de corrida antes del análisis. |

## 18. Matriz de trazabilidad

| HU | Épica | Funcionalidad e hipótesis | Arquitecturas | Sem. | Pts | Prioridad |
|---|---|---|---|---|---|---|
| `HU-01` | E1 | F-1 | Todas | 3 | 3 | Obligatoria |
| `HU-02` | E1 | F-1 | Todas | 3 | 5 | Obligatoria |
| `HU-03` | E1 | F-1, F-7 | Todas | 3 | 2 | Obligatoria |
| `HU-04` | E1 | F-1 | Todas | 3 | 3 | Obligatoria |
| `HU-05` | E2 | F-2, H1 | Todas | 3 | 5 | Obligatoria |
| `HU-06` | E2 | F-2 | Todas | 3 | 5 | Obligatoria |
| `HU-07` | E2 | F-2 | Todas | 3 | 3 | Obligatoria |
| `HU-08` | E2 | F-2 | Todas | 2 | 5 | Obligatoria |
| `HU-09` | E3 | F-3, H2 | Todas | 3 | 5 | Obligatoria |
| `HU-10` | E3 | F-3 | Todas | 3 | 3 | Obligatoria |
| `HU-11` | E3 | F-3 | Todas | 3 | 5 | Obligatoria |
| `HU-12` | E3 | F-3, F-4 | Todas | 3 | 3 | Obligatoria |
| `HU-13` | E4 | F-4, H4 | Todas | 3 | 5 | Obligatoria |
| `HU-14` | E4 | F-4, H4 | Todas | 3 | 8 | Obligatoria |
| `HU-15` | E4 | F-4, H4 | Todas | 3 | 3 | Obligatoria |
| `HU-16` | E4 | F-4, H4 | Todas | 2 | 8 | Obligatoria |
| `HU-17` | E4 | F-4 | Todas | 3 | 3 | Obligatoria |
| `HU-18` | E5 | F-7 | Todas | 4 | 8 | Obligatoria |
| `HU-19` | E5 | F-7, H4 | Todas | 4 | 5 | Obligatoria |
| `HU-20` | E5 | F-7 | B2, B3 | 4 | 5 | Obligatoria |
| `HU-21` | E5 | F-7 | Todas | 4 | 5 | Obligatoria |
| `HU-22` | E5 | F-7 | Todas | 4 | 3 | Obligatoria |
| `HU-23` | E6 | F-6 | Todas | 2 | 3 | Importante |
| `HU-24` | E6 | F-6 | Plataforma | 3 | 2 | Obligatoria |
| `HU-25` | E7 | H1 | B1, B2, B3 | 4 | 8 | Obligatoria |
| `HU-26` | E7 | H1 | B1, B2, B3 | 4 | 2 | Importante |
| `HU-27` | E7 | H1 | Todas | 8 | 5 | Obligatoria |
| `HU-28` | E7 | H1 | B1, B2, B3 | 4 | 3 | Opcional |
| `HU-29` | E8 | H3 | B3 | 5 | 8 | Obligatoria |
| `HU-30` | E8 | H2, H3 | B2, B3 | 5 | 8 | Obligatoria |
| `HU-31` | E8 | H3, H4 | B3 | 5 | 5 | Obligatoria |
| `HU-32` | E8 | H3 | B3 | 5 | 5 | Obligatoria |
| `HU-33` | E9 | F-5 | Todas | 3 | 8 | Obligatoria |
| `HU-34` | E9 | F-5, H3 | Todas | 3 | 8 | Obligatoria |
| `HU-35` | E9 | F-5 | Todas | 2 | 5 | Obligatoria |
| `HU-36` | E10 | F-6 | Plataforma | 2 | 5 | Obligatoria |
| `HU-37` | E10 | H1, H2, H3 | Plataforma | 3 | 13 | Obligatoria |
| `HU-38` | E10 | H1, H2, H3 | Plataforma | 3 | 5 | Obligatoria |
| `HU-39` | E10 | H1, H2, H3 | Plataforma | 2 | 8 | Obligatoria |
| `HU-40` | E11 | H1, H2, H3, H4 | Plataforma | 3 | 8 | Obligatoria |
| `HU-41` | E11 | H1, H2, H3 | Plataforma | 7 | 5 | Obligatoria |
| `HU-42` | E11 | H1, H2, H3 | Plataforma | 7 | 8 | Obligatoria |
| `HU-43` | E11 | H1 | Todas | 8 | 5 | Obligatoria |
| `HU-44` | E12 | H1, H2, H3 | Plataforma | 9 | 8 | Obligatoria |
| `HU-45` | E12 | H1, H2, H3, H4 | Plataforma | 9 | 5 | Obligatoria |

## 19. Orden de construcción

| Semana | Historias | Esfuerzo |
|---|---|---|
| 2 | HU-08, HU-16, HU-23, HU-35, HU-36, HU-39 | 34 pts |
| 3 | HU-01, HU-02, HU-03, HU-04, HU-05, HU-06, HU-07, HU-09, HU-10, HU-11, HU-12, HU-13, HU-14, HU-15, HU-17, HU-24, HU-33, HU-34, HU-37, HU-38, HU-40 | 105 pts |
| 4 | HU-18, HU-19, HU-20, HU-21, HU-22, HU-25, HU-26, HU-28 | 39 pts |
| 5 | HU-29, HU-30, HU-31, HU-32 | 26 pts |
| 7 | HU-41, HU-42 | 13 pts |
| 8 | HU-27, HU-43 | 10 pts |
| 9 | HU-44, HU-45 | 13 pts |

**Observación sobre la carga de la semana 3.** Concentra 105 de los 240 puntos estimados (cerca del 44 %). No es un error de estimación: B0 es la primera arquitectura completa, así que toda la superficie del producto se vuelve observable de una sola vez. La puerta de calidad de esa semana —resolver 7 de 10 tareas piloto— no captura ese riesgo. Mitigaciones recomendadas: adelantar a la semana 2 todo el trabajo de servidor del que dependen estas historias (el plan ya lo ubica allí) y poner un punto de control a mitad de la semana 3 con E1 y E2 terminadas, antes de abordar E3 y E4.

## 20. Fuera de alcance

Tan vinculante como las historias. Incorporar cualquiera de estos elementos exige indicar qué historia obligatoria se retira a cambio.

| No se construye | Por qué |
|---|---|
| Autenticación de usuarios finales y gestión de sesiones | No aporta a ninguna de las cuatro hipótesis y consume tiempo de la semana 2. |
| Interfaz gráfica de usuario | La interacción del experimento es por conversación; una interfaz añadiría una variable que nadie va a medir. |
| Integración con sistemas institucionales reales | Está excluida por el alcance declarado del seminario y por el manejo de datos. |
| Flujo completo de ciclo de vida del ticket (asignación, escalamiento, cierre) | Ninguna de las 40 tareas lo ejercita. Los estados existen como dato, no como flujo. |
| Un tercer agente especialista | El plan limita el alcance a dos especialistas; añadir un tercero cambiaría la comparación a mitad del experimento. |
| Comparación entre proveedores comerciales de modelos | El estudio compara arquitecturas de integración, no modelos. El chequeo con modelo abierto es de robustez, no una condición más. |
| Notificaciones asíncronas hacia el solicitante | El protocolo lo permite, pero ninguna tarea lo requiere y añadiría infraestructura sin retorno experimental. |
| Búsqueda semántica con representaciones vectoriales | Introduciría variabilidad en la recuperación y haría imposible atribuir un fallo al protocolo. Decisión registrada. |
