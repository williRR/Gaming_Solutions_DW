# ============================================================
# ETAPA 1 - BUILD
# Compila la aplicación React (Vite) a archivos estáticos
# ============================================================
FROM node:18-alpine AS build

WORKDIR /app

# Copiamos primero solo los manifiestos para aprovechar la
# caché de capas de Docker: si package.json no cambia,
# Docker reutiliza la capa de "npm install" en builds futuros.
COPY package*.json ./

RUN npm install

# Copiamos el resto del código fuente
COPY . .

# Genera la carpeta /app/dist con HTML/CSS/JS estáticos y optimizados
RUN npm run build


# ============================================================
# ETAPA 2 - PRODUCCIÓN
# Imagen ligera de Nginx que sirve los estáticos ya compilados
# ============================================================
FROM nginx:alpine AS production

# Eliminamos la configuración default de Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiamos nuestra configuración personalizada (maneja rutas de SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos SOLO los archivos estáticos generados en la Etapa 1
# (la imagen final NO contiene Node, npm ni el código fuente)
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
