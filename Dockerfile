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

RUN if [ -f scripts/generate-env.js ]; then node scripts/generate-env.js; fi

RUN npm run build -- --configuration=production || npm run build

FROM nginx:alpine

COPY --from=builder /app/frontend/dist/front/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
