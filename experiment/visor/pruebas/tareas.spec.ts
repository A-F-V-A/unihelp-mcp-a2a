/**
 * Una prueba por (tarea, repeticion): la persona simulada escribe los turnos de
 * `docs/tasks/<id>.yaml` en el frontend real y el panel muestra lo que el backend
 * midio. Filtrar con `--grep T-COM` o por etiqueta (`--grep @compuesta`).
 *
 * Que hace fallar la prueba: el backend no responde o informa otra arquitectura,
 * la huella del estado no es la esperada, un turno no obtiene respuesta o el
 * agente se corta (timeout, limite de herramientas, error). El veredicto de la
 * compuerta NO la hace fallar salvo `medicion.fallar_si_reprueba_compuerta`.
 */
import { expect, test, type Page } from '@playwright/test';
import type { BloqueRespuestaDto, RespuestaMensajeDto } from '@unihelp/contratos';
import { ClienteBackendVisor, ErrorBackendVisor } from '../src/backend';
import { cargarConfiguracion, nombreCorrida } from '../src/configuracion';
import { escribirObservacion, puntuarConPython } from '../src/observaciones';
import { Panel, type TurnoPanel } from '../src/panel';
import { Persona, semillaDe } from '../src/persona';
import { cargarTareas, huellaEsperada, huellasPorVariante, seleccionarTareas } from '../src/tareas';
import type { Observacion, TareaVisor, TurnoObservado } from '../src/tipos';

const configuracion = cargarConfiguracion();
const tareas = seleccionarTareas(cargarTareas(), configuracion.tareas);
const variantes = configuracion.entorno.verificarHuella
  ? huellasPorVariante()
  : new Map<string, string>();
const directorioCorrida = `${configuracion.salidas.directorio}/${nombreCorrida()}`;

const RUTA_MENSAJES = '/api/conversaciones/mensajes';

function marcaAhora(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/** Mismo criterio que `_texto_de` en `experiment/ejecutor/cliente.py`. */
function textoDe(bloques: readonly BloqueRespuestaDto[]): string {
  return bloques
    .filter((b): b is Extract<BloqueRespuestaDto, { tipo: 'texto' }> => b.tipo === 'texto')
    .map((b) => b.texto)
    .join('\n\n')
    .trim();
}

function tiempoDePrueba(tarea: TareaVisor): number {
  const porTurno = configuracion.tiempoMaximoTurnoS * 1000 + 60_000;
  return tarea.turnos.length * porTurno + configuracion.persona.pausaFinalMs + 120_000;
}

// Una ejecucion a la vez: el restablecimiento del entorno es global (RM-04).
test.describe.configure({ mode: 'serial' });

for (const tarea of tareas) {
  test.describe(tarea.categoria, () => {
    for (let repeticion = 1; repeticion <= configuracion.repeticiones; repeticion += 1) {
      test(
        `${tarea.id} r${repeticion} · ${tarea.titulo}`,
        { tag: [`@${tarea.categoria}`, `@${tarea.id}`] },
        async ({ page, context, request }, info) => {
          test.setTimeout(tiempoDePrueba(tarea));
          const marca = marcaAhora();
          const runId = `${tarea.id}|${configuracion.arquitectura}|r${repeticion}|${marca}`;
          const traceIdPropio = `visor-${marca}-${tarea.id}-${configuracion.arquitectura}-r${repeticion}`;
          const inicioIso = new Date().toISOString();
          const backend = new ClienteBackendVisor(
            request,
            configuracion.backend,
            configuracion.tiempoMaximoTurnoS * 1000,
          );
          const panel = new Panel(page, configuracion.panel.visible, {
            ancho: configuracion.panel.ancho,
            arquitectura: configuracion.arquitectura,
            backend: configuracion.backend,
          });
          const persona = new Persona(
            page,
            configuracion.persona,
            semillaDe(configuracion.persona.semilla, tarea.id, repeticion),
          );
          const esperada = huellaEsperada(tarea, variantes);
          const conversacion: TurnoObservado[] = [];
          const errores: { tipo: string; mensaje: string }[] = [];
          let estadoForzado: Observacion['estado_forzado'] = null;
          let huellaObtenida = '';
          let traceId = configuracion.entorno.enviarTraceId ? traceIdPropio : null;

          panel.estado.tarea = {
            id: tarea.id,
            categoria: tarea.categoria,
            titulo: tarea.titulo,
            overlay: tarea.overlay,
            corpus: tarea.corpus,
            repeticion,
            vector: tarea.vectorAdversarial,
            esperado: tarea.esperado,
          };
          panel.estado.traceId = traceId;
          if (!configuracion.medicion.compuerta) {
            panel.estado.compuerta = { estado: 'desactivada' };
          }

          await test.step('el backend responde y es la arquitectura esperada', async () => {
            const salud = await backend.salud();
            expect(
              salud.arquitectura,
              `${configuracion.backend} informa ${salud.arquitectura}, no ${configuracion.arquitectura}`,
            ).toBe(configuracion.arquitectura);
          });

          if (configuracion.entorno.restablecer) {
            await test.step(`restablecer el entorno: ${tarea.overlay} × ${tarea.corpus}`, async () => {
              try {
                const entorno = await backend.restablecer(tarea.overlay, tarea.corpus);
                huellaObtenida = entorno.huella;
              } catch (error) {
                if (error instanceof ErrorBackendVisor && error.status === 404) {
                  throw new Error(
                    'El backend no expone /experimento/restablecer: levantarlo con UNIHELP_PERFIL=experimento ' +
                      'o poner entorno.restablecer: false en visor.config.yaml.',
                  );
                }
                throw error;
              }
              panel.estado.huella = {
                esperada,
                obtenida: huellaObtenida,
                coincide: esperada === null ? null : huellaObtenida === esperada,
              };
              if (configuracion.entorno.verificarHuella && esperada !== null) {
                expect(
                  huellaObtenida,
                  'la huella del estado inicial no es la esperada (M7.2)',
                ).toBe(esperada);
              }
            });
          } else {
            // Sin restablecer no se sabe con que estado arranco: se anota la esperada, marcada como no verificada.
            huellaObtenida = esperada ?? `sha256:${'0'.repeat(64)}`;
          }

          if (traceId !== null) {
            // Como el ejecutor: el backend ata la conversacion a este trace y mide con el modelo configurado.
            await context.setExtraHTTPHeaders({ 'x-trace-id': traceId });
          }
          await panel.instalar();

          await test.step('abrir el frontend', async () => {
            await page.goto(
              `${configuracion.frontend}/?backend=${encodeURIComponent(configuracion.backend)}`,
            );
            await expect(page.locator('.backend strong')).toHaveText(configuracion.arquitectura, {
              timeout: 30_000,
            });
            await panel.fase('Frontend listo');
          });

          const campo = page.locator('#solicitud');
          let pidioConfirmacion = false;
          let conversacionId: string | null = null;

          for (const [indice, turnoTarea] of tarea.turnos.entries()) {
            const n = indice + 1;
            if (turnoTarea.condicionDeEnvio !== null && !pidioConfirmacion) {
              // El agente no propuso nada: enviar la confirmacion falsearia la conversacion (M5.3).
              const turno = panel.turno(n, turnoTarea.texto);
              turno.omitido = 'turno omitido: el agente no pidió confirmación';
              await panel.evento(`turno ${n} omitido: sin propuesta que confirmar`);
              break;
            }

            const usaBoton =
              turnoTarea.condicionDeEnvio !== null &&
              configuracion.persona.confirmacion === 'boton';
            const turno = panel.turno(
              n,
              usaBoton ? '[botón] Confirmar y crear ticket' : turnoTarea.texto,
            );

            await test.step(`turno ${n}`, async () => {
              if (usaBoton) {
                await confirmarConBoton(page, panel, persona, turno, conversacion, n);
                return;
              }
              await panel.fase(`Turno ${n}: escribiendo`);
              await expect(campo).toBeEnabled({ timeout: 30_000 });
              await persona.escribir(campo, turnoTarea.texto);
              await panel.fase(`Turno ${n}: esperando la respuesta del agente`);
              conversacion.push({
                turno: conversacion.length + 1,
                rol: 'usuario',
                texto: turnoTarea.texto,
              });

              const esperaRespuesta = page.waitForResponse(
                (r) => r.url().endsWith(RUTA_MENSAJES) && r.request().method() === 'POST',
                { timeout: configuracion.tiempoMaximoTurnoS * 1000 },
              );
              const inicioTurno = Date.now();
              await page.locator('button.compositor__enviar').click();

              let respuesta;
              try {
                respuesta = await esperaRespuesta;
              } catch (error) {
                estadoForzado = 'error_infraestructura';
                errores.push({ tipo: 'turno', mensaje: `sin respuesta HTTP: ${String(error)}` });
                throw error;
              }
              turno.ms = Date.now() - inicioTurno;

              if (respuesta.status() === 503) {
                estadoForzado = 'error_infraestructura';
                errores.push({ tipo: 'turno', mensaje: 'el backend respondió 503' });
                throw new Error('El backend respondió 503 (servicio no disponible).');
              }
              if (respuesta.status() >= 400) {
                // Error del contrato: es fallo del agente y cuenta, igual que en el ejecutor.
                const cuerpo = (await respuesta.text()).slice(0, 400);
                conversacion.push({
                  turno: conversacion.length + 1,
                  rol: 'agente',
                  texto: `[error del backend] ${respuesta.status()} ${cuerpo}`,
                });
                turno.textoAgente = `[error del backend] ${respuesta.status()} ${cuerpo}`;
                await panel.evento(`turno ${n}: el backend respondió ${respuesta.status()}`);
                throw new Error(
                  `El backend respondió ${respuesta.status()} en el turno ${n}: ${cuerpo}`,
                );
              }

              const datos = (await respuesta.json()) as RespuestaMensajeDto;
              conversacionId = datos.conversacionId;
              if (traceId === null) {
                // Convencion de B0 sin X-Trace-Id: el trace es el de la conversacion.
                traceId = `conv-${conversacionId}`;
                panel.estado.traceId = traceId;
              }
              const texto = textoDe(datos.respuesta.bloques);
              conversacion.push({ turno: conversacion.length + 1, rol: 'agente', texto });
              turno.textoAgente = texto;
              pidioConfirmacion = datos.accionSugerida === 'proponer-ticket';
              turno.pidioConfirmacion = pidioConfirmacion;

              await expect(
                page.locator(`[data-rol="asistente"][data-turno="${n}"]`).first(),
              ).toBeVisible({
                timeout: 15_000,
              });
              await leerMedicion(backend, panel, traceId, turno);
              await panel.fase(`Turno ${n}: leyendo la respuesta`);
              await persona.esperar(persona.pausaLectura(texto));
            });
          }

          await test.step('cierre', async () => {
            await panel.fase('Leyendo la traza final');
            const parcial = await leerMedicion(backend, panel, traceId, null);
            const finIso = new Date().toISOString();
            const observacion: Observacion = {
              version: 1,
              origen: 'visor',
              run_id: runId,
              trace_id: traceId ?? traceIdPropio,
              task_id: tarea.id,
              condicion: configuracion.arquitectura,
              repeticion,
              huella_estado: huellaObtenida,
              huella_esperada: esperada,
              entorno_restablecido: configuracion.entorno.restablecer,
              inicio_iso: inicioIso,
              fin_iso: finIso,
              conversacion,
              parcial,
              errores,
              estado_forzado: estadoForzado,
              persona: {
                confirmacion: configuracion.persona.confirmacion,
                semilla: configuracion.persona.semilla,
              },
            };
            const ruta = escribirObservacion(directorioCorrida, observacion);
            await info.attach('observacion.json', {
              body: JSON.stringify(observacion, null, 2),
              contentType: 'application/json',
            });
            info.annotations.push({ type: 'observaciones', description: ruta });

            if (parcial) {
              info.annotations.push({
                type: 'tokens',
                description: `entrada ${parcial.usage.input_tokens} · salida ${parcial.usage.output_tokens} · llamadas ${parcial.usage.llm_calls} · ${parcial.timing.total_ms} ms`,
              });
            }

            if (configuracion.medicion.compuerta) {
              await panel.fase('Compuerta automática (Python)');
              const resultado = puntuarConPython(observacion);
              await panel.compuerta(resultado);
              info.annotations.push({
                type: 'compuerta',
                description: resultado.disponible
                  ? resultado.veredicto.exito
                    ? 'supera'
                    : `no supera: ${(resultado.veredicto.traza_valida ? resultado.veredicto.motivos : resultado.veredicto.errores_esquema).join('; ')}`
                  : `no disponible: ${resultado.motivo}`,
              });
              if (configuracion.medicion.fallarSiRepruebaCompuerta && resultado.disponible) {
                expect(resultado.veredicto.exito, 'la compuerta automática no se supera').toBe(
                  true,
                );
              }
            }

            await panel.fase('Terminada', false);
            await info.attach('pantalla-final.png', {
              body: await page.screenshot({ fullPage: false }),
              contentType: 'image/png',
            });
            await persona.esperar(configuracion.persona.pausaFinalMs);

            if (parcial) {
              const cortes = parcial.terminaciones.filter((t) => t !== 'respuesta');
              expect(cortes, `el agente se cortó: ${cortes.join(', ')}`).toEqual([]);
            }
          });
        },
      );
    }
  });
}

async function leerMedicion(
  backend: ClienteBackendVisor,
  panel: Panel,
  traceId: string | null,
  turno: TurnoPanel | null,
) {
  if (!configuracion.medicion.habilitada || traceId === null) {
    return null;
  }
  const parcial = await backend.trazaParcial(traceId);
  await panel.medicion(parcial, turno);
  return parcial;
}

/** Camino del frontend: la tarjeta de propuesta y su boton (HU-17). No es comparable con el ejecutor. */
async function confirmarConBoton(
  page: Page,
  panel: Panel,
  persona: Persona,
  turno: TurnoPanel,
  conversacion: TurnoObservado[],
  n: number,
): Promise<void> {
  await panel.fase(`Turno ${n}: confirmando con el botón`);
  const boton = page.locator('[data-accion="confirmar"]').first();
  await expect(boton).toBeVisible({ timeout: 30_000 });
  await persona.esperar(persona.pausaLectura('propuesta'));
  const inicio = Date.now();
  await boton.click();
  const tarjeta = page.locator('app-ticket-created-card [data-numero]').first();
  await expect(tarjeta).toBeVisible({ timeout: configuracion.tiempoMaximoTurnoS * 1000 });
  turno.ms = Date.now() - inicio;
  const numero = (await tarjeta.textContent())?.trim() ?? '';
  turno.textoAgente = `ticket creado ${numero}`;
  conversacion.push({
    turno: conversacion.length + 1,
    rol: 'usuario',
    texto: '[botón] Confirmar y crear ticket',
  });
  conversacion.push({
    turno: conversacion.length + 1,
    rol: 'agente',
    texto: `[tarjeta] ticket creado ${numero}`,
  });
  await panel.evento(`ticket ${numero} creado con el botón`);
}
