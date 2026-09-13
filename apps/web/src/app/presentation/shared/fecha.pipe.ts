import { Pipe, type PipeTransform } from '@angular/core';
import { type FormatoFecha, formatearFecha } from './formato';

@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(valor: Date, formato: FormatoFecha = 'fecha-hora'): string {
    return formatearFecha(valor, formato);
  }
}
