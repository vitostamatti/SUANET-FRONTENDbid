# Etapa de construcción
FROM node:20-alpine AS builder

# ✅ NUEVO: Definir build args para variables de entorno de Next.js
ARG NEXT_PUBLIC_BACKEND_URL=https://suanet.movilidadbogota.gov.co
ARG NEXT_PUBLIC_FRONTEND_URL=https://suanet.movilidadbogota.gov.co
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_POWERBI_DESCRIPTIVO_URL
ARG NEXT_PUBLIC_POWERBI_TRAFICO_URL
ARG APP_VERSION=dev

# ✅ NUEVO: Establecer las variables como ENV para que Next.js las empaquete
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_FRONTEND_URL=${NEXT_PUBLIC_FRONTEND_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
ENV NEXT_PUBLIC_POWERBI_DESCRIPTIVO_URL=${NEXT_PUBLIC_POWERBI_DESCRIPTIVO_URL}
ENV NEXT_PUBLIC_POWERBI_TRAFICO_URL=${NEXT_PUBLIC_POWERBI_TRAFICO_URL}
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tailwind.config.js ./
COPY tailwind.config.ts ./
COPY next.config.js ./
COPY tsconfig.json ./

# Instalar dependencias con verbose output
RUN npm install

# Asegurar que @headlessui/tailwindcss está instalado
RUN npm install @headlessui/tailwindcss

# Instala las dependencias y configura la zona horaria
RUN apk update && \
    apk add --no-cache \
      busybox \
      busybox-extras \
      bash \
      tzdata \
      libaio \
      iputils \
      netcat-openbsd \
      htop \
      tmux \
      vim \
      net-tools \
      nmap \
      traceroute \
      curl

# Copiar el resto del código
COPY . .

# Construir la aplicación - fallará si hay errores críticos
RUN npm run build

# Etapa de producción
FROM node:20-alpine

WORKDIR /app

# Crear un usuario no root con UID/GID específicos que coincidan con el deployment.yaml
RUN addgroup -g 10001 -S appgroup && adduser -u 10001 -S appuser -G appgroup

# Copiar el código compilado desde la etapa anterior
COPY --from=builder /app ./

# Instalar dependencias básicas
RUN apk update && \
    apk add --no-cache \
    busybox \
    busybox-extras \
    bash \
    vim \
    tmux \
    htop \
    net-tools \
    curl \
    iputils \
    tzdata && \
    cp /usr/share/zoneinfo/America/Bogota /etc/localtime && \
    echo "America/Bogota" > /etc/timezone

# Crear directorio public si no existe y asignar permisos
RUN mkdir -p /app/public && \
    chown -R appuser:appgroup /app/public && \
    chmod -R 755 /app/public

# Cambiar al usuario no root
USER appuser

# Exponer el puerto 3000
EXPOSE 3000

# Establecer las variables de entorno necesarias
ENV PORT=3000
ENV NODE_ENV=production

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Comando para ejecutar la aplicación
CMD ["node", "server.js"]