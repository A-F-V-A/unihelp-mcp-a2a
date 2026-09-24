#!/bin/sh
# UniHelp - inyecta la URL del backend activo en el frontend ya compilado.
#
# El bundle Angular lee `config.json` antes de arrancar, de modo que la misma
# imagen sirve para B0, B1, B2 y B3 sin recompilar nada.
set -eu

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
CONSOLA_URL="${CONSOLA_URL:-http://localhost:3030}"
DESTINO="/usr/share/nginx/html/config.json"

cat > "$DESTINO" <<JSON
{
  "backendUrl": "${BACKEND_URL}",
  "consolaUrl": "${CONSOLA_URL}"
}
JSON

echo "[unihelp-web] backendUrl=${BACKEND_URL} consolaUrl=${CONSOLA_URL}"
