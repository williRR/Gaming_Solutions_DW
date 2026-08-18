# Gaming Solutions — Landing Page (Fase 1)

Landing page de presentación para **Gaming Solutions**, construida con
**React + Vite + Tailwind CSS**, empaquetada para producción con
**Docker + Nginx**.

## Estructura del proyecto

```
gaming-solutions/
├── src/
│   ├── components/
│   │   ├── Navigation.jsx
│   │   ├── HeroSection.jsx
│   │   ├── CategoriesSection.jsx
│   │   ├── TrustSection.jsx
│   │   └── Footer.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── .dockerignore
```

## Opción A: Ejecutar con Docker (recomendado, 100% portable)

Requisito único: tener **Docker** y **Docker Compose** instalados.

```bash
# 1. Ubícate en la carpeta del proyecto
cd gaming-solutions

# 2. Construye la imagen y levanta el contenedor
docker-compose up --build

# 3. Abre en el navegador
http://localhost:3000
```

### Qué ocurre por dentro (paso a paso)

1. `docker-compose up --build` lee `docker-compose.yml` y ejecuta `docker build`
   usando el `Dockerfile` en dos etapas:
   - **Etapa `build`** (`node:18-alpine`): instala dependencias con `npm install`
     y ejecuta `npm run build`, generando la carpeta `dist/` con HTML/CSS/JS
     ya optimizados y minificados.
   - **Etapa `production`** (`nginx:alpine`): parte de una imagen limpia de
     Nginx, copia **únicamente** el contenido de `dist/` (no Node, no
     `node_modules`, no código fuente) y aplica `nginx.conf`, que enruta
     cualquier ruta desconocida hacia `index.html` (necesario para SPAs).
2. El contenedor final expone el puerto `80` internamente.
3. `docker-compose.yml` mapea `3000:80`, por lo que el sitio queda disponible
   en `http://localhost:3000` de la máquina anfitriona.

### Comandos útiles

```bash
# Levantar en segundo plano
docker-compose up -d --build

# Ver logs del contenedor
docker-compose logs -f

# Detener y eliminar el contenedor
docker-compose down

# Reconstruir desde cero sin caché (tras cambios grandes)
docker-compose build --no-cache
```

## Opción B: Ejecutar en modo desarrollo (sin Docker)

Requisito: Node.js 18+.

```bash
npm install
npm run dev
```

Esto levanta un servidor de desarrollo con hot-reload (por defecto en
`http://localhost:5173`).

Para generar el build de producción manualmente (sin Docker):

```bash
npm run build
npm run preview
```

## Personalización rápida

- **Colores**: definidos en `tailwind.config.js` (`base.bg`, y los acentos
  `cyan-500`, `purple-600`, `amber-500` de Tailwind por defecto).
- **Textos e íconos**: editables directamente en cada componente dentro de
  `src/components/`.
- **Puerto expuesto**: cambia el `3000` en `docker-compose.yml` si ya lo
  tienes ocupado, por ejemplo `"8080:80"`.
