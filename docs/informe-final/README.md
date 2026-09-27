# Informe final de UniHelp

Documento completo del proyecto: cómo funciona el sistema por dentro y qué mostró
el experimento. Ninguna cifra se escribe a mano: las tablas salen de los
`resultados.json` que calculó el cuaderno (RM-02) y toda imagen tiene el código que
la produce (HU-45).

| Archivo | Qué es |
| --- | --- |
| [`INFORME-UNIHELP.md`](INFORME-UNIHELP.md) | El informe, generado por `ensamblar.py`; no editar a mano |
| `INFORME-UNIHELP.docx` | La misma versión en Word, con imágenes incrustadas, generada por `a-word.mjs` |
| [`fuente/`](fuente) | El texto del informe en cinco partes, con marcadores `{{T…}}` y `{{mermaid:…}}` |
| [`tablas.py`](tablas.py) → [`tablas.md`](tablas.md) | Extrae las tablas T1 a T14 de los `resultados.json` archivados y de `experiment/m6/resultados-m6.json` |
| [`figuras.py`](figuras.py) | Dibuja las figuras `imagenes/fig-*.svg` y `.png` a partir de los mismos archivos |
| [`diagramas/`](diagramas) y [`diagramas.mjs`](diagramas.mjs) | Fuentes Mermaid de los diagramas y su exportación a `imagenes/diag-*.svg` y `.png` |
| [`ensamblar.py`](ensamblar.py) | Une `fuente/*.md` y sustituye los marcadores por las tablas y los diagramas |
| [`a-word.mjs`](a-word.mjs) | Convierte el informe a Word, cambiando cada bloque Mermaid por su PNG |
| [`imagenes/`](imagenes) | Figuras, diagramas y capturas del panel web |

## Cómo regenerarlo

Desde la raíz del repositorio, en este orden:

```text
cd experiment
uv run papermill analisis.ipynb <tmp>/analisis.ipynb --cwd . \
  -p directorio_corrida resultados/2026-09-25-campana-gpt-5-5-2026-04-23-r3 \
  -p directorio_salidas <tmp>/salidas        # resultados.json con el registro 1.3.0 (trae M6)
uv run python ../docs/informe-final/figuras.py
uv run python ../docs/informe-final/tablas.py <tmp>/salidas/resultados.json
cd ..
node docs/informe-final/diagramas.mjs         # Playwright del repositorio + Chrome del sistema
python docs/informe-final/ensamblar.py
```

La versión en Word necesita `docx`, `marked` e `image-size`, que no son
dependencias del monorepo. Se instalan en una carpeta aparte y se indica con
`UNIHELP_WORD_DEPS`:

```text
npm install --prefix <carpeta> docx@9 marked@15 image-size@1
UNIHELP_WORD_DEPS=<carpeta>/x.js node docs/informe-final/a-word.mjs
```

## Qué no se generó en esta sesión

Las capturas `imagenes/captura-*.png` son de un intento anterior de esta misma
tarea, tomadas con el MCP de Playwright sobre el panel en `localhost:4200`. El
chat se capturó sin backend.
