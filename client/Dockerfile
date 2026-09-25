FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

ARG VITE_API_URL=http://localhost:5000/api
ARG VITE_SOCKET_URL=http://localhost:5000
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}

COPY index.html vite.config.ts tsconfig.json tailwind.config.cjs postcss.config.cjs ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
