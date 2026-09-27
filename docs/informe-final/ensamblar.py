"""Arma docs/informe-final/INFORME-UNIHELP.md a partir de fuente/*.md.

Sustituye dos tipos de marcador para que ninguna cifra ni diagrama se copie a mano:

- `{{T12}}` o `{{T2. Consumo · gpt-5.5}}`: la tabla de `tablas.md` cuyo encabezado
  `### ` empieza con ese texto (debe haber exactamente una), con su línea de fuente.
- `{{mermaid:01-monorepo}}`: el contenido de `diagramas/01-monorepo.mmd`.

Uso: python docs/informe-final/ensamblar.py (después de tablas.py).
"""

from __future__ import annotations

import re
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MARCADOR = re.compile(r'\{\{([^{}]+)\}\}')


def bloques_de_tablas() -> dict[str, str]:
    texto = (AQUI / 'tablas.md').read_text(encoding='utf-8')
    bloques = {}
    for trozo in texto.split('\n### ')[1:]:
        titulo, _, cuerpo = trozo.partition('\n')
        bloques[titulo.strip()] = cuerpo.strip()
    return bloques


def main() -> None:
    tablas = bloques_de_tablas()

    def sustituir(coincidencia: re.Match[str]) -> str:
        clave = coincidencia.group(1).strip()
        if clave.startswith('mermaid:'):
            return (AQUI / 'diagramas' / f'{clave.removeprefix("mermaid:")}.mmd').read_text(encoding='utf-8').strip()
        halladas = [t for t in tablas if t == clave or t.startswith(clave + '.') or t.startswith(clave + ' ')]
        if len(halladas) != 1:
            raise SystemExit(f'El marcador {{{{{clave}}}}} coincide con {len(halladas)} tablas: {halladas}')
        titulo = halladas[0]
        return f'**{titulo}**\n\n{tablas[titulo]}'

    partes = [p.read_text(encoding='utf-8') for p in sorted((AQUI / 'fuente').glob('*.md'))]
    informe = MARCADOR.sub(sustituir, '\n'.join(partes))
    (AQUI / 'INFORME-UNIHELP.md').write_text(informe.rstrip() + '\n', encoding='utf-8')
    print(f'escrito INFORME-UNIHELP.md ({informe.count(chr(10))} líneas)')


if __name__ == '__main__':
    main()
