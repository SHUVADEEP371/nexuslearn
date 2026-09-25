FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY routes ./routes
COPY models ./models
COPY middleware ./middleware
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Typed controllers use these existing JavaScript route/model modules.
COPY --from=build /app/routes ./routes
COPY --from=build /app/models ./models
COPY --from=build /app/middleware ./middleware
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node
EXPOSE 5000
CMD ["npm", "start"]
