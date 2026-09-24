/**
 * La persona simulada: teclea con ritmo variable, se equivoca de vez en cuando
 * y "lee" antes de contestar. Toda la aleatoriedad sale de una semilla, asi que
 * dos corridas con la misma configuracion teclean exactamente igual.
 */
import type { Locator, Page } from '@playwright/test';
import type { ConfiguracionPersona } from './tipos';

/** Generador determinista (mulberry32): suficiente para ritmos de tecleo, no para criptografia. */
export function generadorDeterminista(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla propia de cada (tarea, repeticion), derivada de la semilla global. */
export function semillaDe(semilla: number, tareaId: string, repeticion: number): number {
  let h = semilla >>> 0;
  for (const caracter of `${tareaId}#${repeticion}`) {
    h = Math.imul(h ^ caracter.charCodeAt(0), 16777619) >>> 0;
  }
  return h;
}

const LETRAS = 'abcdefghijklmnopqrstuvwxyz';

export class Persona {
  private readonly azar: () => number;

  constructor(
    private readonly page: Page,
    private readonly configuracion: ConfiguracionPersona,
    semilla: number,
  ) {
    this.azar = generadorDeterminista(semilla);
  }

  private entre(minimo: number, maximo: number): number {
    return minimo + this.azar() * (maximo - minimo);
  }

  async esperar(ms: number): Promise<void> {
    if (ms > 0) {
      await this.page.waitForTimeout(ms);
    }
  }

  /** Cuanto tarda en "leer" una respuesta antes de volver a escribir. */
  pausaLectura(texto: string): number {
    const { pausaLecturaMs, pausaLecturaPorCaracterMs, pausaLecturaMaximaMs } = this.configuracion;
    return Math.min(
      pausaLecturaMaximaMs,
      pausaLecturaMs + texto.length * pausaLecturaPorCaracterMs,
    );
  }

  /** Teclea `texto` en el campo, letra a letra, con errores corregidos segun la configuracion. */
  async escribir(campo: Locator, texto: string): Promise<void> {
    await this.esperar(this.configuracion.pausaAntesDeEscribirMs);
    await campo.click();
    const [minimo, maximo] = this.configuracion.tecleoMs;
    for (const caracter of texto) {
      if (/[a-z]/.test(caracter) && this.azar() < this.configuracion.erroresDeTecleo) {
        const equivocada = LETRAS[Math.floor(this.azar() * LETRAS.length)];
        await this.page.keyboard.type(equivocada, { delay: 0 });
        await this.esperar(this.entre(minimo, maximo) * 2);
        await this.page.keyboard.press('Backspace');
        await this.esperar(this.entre(minimo, maximo));
      }
      await this.page.keyboard.type(caracter, { delay: 0 });
      // Los espacios y los signos llevan una pausa algo mayor: es donde una persona respira.
      const factor = /[\s.,;:?!]/.test(caracter) ? 1.8 : 1;
      await this.esperar(this.entre(minimo, maximo) * factor);
    }
  }
}
