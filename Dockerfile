FROM node:20-alpine AS builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG API_URL
ARG SOCKET_URL
ARG API_KEY_GOOGLE_MAPS
ARG MAPS_MAP_ID

ENV API_URL=${API_URL:-http://localhost:8080} \
    SOCKET_URL=${SOCKET_URL:-http://localhost:8080} \
    GOOGLE_MAPS_API_KEY=${API_KEY_GOOGLE_MAPS:-} \
    GOOGLE_MAPS_MAP_ID=${MAPS_MAP_ID:-}

# Generar archivos de environment antes del build
RUN echo "Generating environment files with:" && \
    echo "API_URL=${API_URL}" && \
    echo "SOCKET_URL=${SOCKET_URL}" && \
    echo "GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}" && \
    echo "GOOGLE_MAPS_MAP_ID=${GOOGLE_MAPS_MAP_ID}" && \
    if [ -f scripts/generate-env.js ]; then \
      node scripts/generate-env.js && \
      echo "Environment files generated successfully" && \
      echo "--- environment.prod.ts content ---" && \
      cat src/environments/environment.prod.ts && \
      echo "--- end environment.prod.ts ---"; \
    else \
      echo "ERROR: generate-env.js not found!"; \
      exit 1; \
    fi

# Verificar que los archivos de environment existen antes del build
RUN echo "=== Verifying environment files ===" && \
    ls -la src/environments/ && \
    echo "=== Building Angular application ===" && \
    npm run build -- --configuration=production || npm run build

FROM nginx:alpine

COPY --from=builder /app/frontend/dist/front/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Script de inicio que configura el puerto dinámicamente
COPY start-nginx.sh /start-nginx.sh
RUN chmod +x /start-nginx.sh

# Cloud Run usa PORT=8080, pero también soportamos otros puertos
EXPOSE 8080

CMD ["/start-nginx.sh"]
