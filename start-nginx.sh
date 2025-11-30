#!/bin/sh
set -e

# Si se pasa la variable PORT, reemplaza la directiva listen en la conf de nginx
if [ -n "$PORT" ]; then
  # Reemplaza 'listen <num>;' por 'listen ${PORT};' dentro del archivo de conf
  sed -i "s/listen[[:space:]]*[0-9]\+;/listen ${PORT};/g" /etc/nginx/conf.d/default.conf || true
fi

# Ejecuta nginx en foreground
exec nginx -g 'daemon off;'
