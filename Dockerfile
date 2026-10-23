FROM node:24.21.0-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY app/package.json ./app/package.json
COPY api/package.json ./api/package.json
RUN npm ci
COPY app ./app
COPY api ./api
COPY scripts ./scripts
COPY infra ./infra
ARG SUPABASE_URL
ARG SUPABASE_PUBLISHABLE_KEY
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
RUN npm run build
RUN npm prune --omit=dev

FROM node:24.21.0-bookworm-slim
ENV NODE_ENV=production PORT=10000 STATIC_DIRECTORY=/workspace/app/dist
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/package.json ./package.json
COPY --from=build --chown=node:node /workspace/api/package.json ./api/package.json
COPY --from=build --chown=node:node /workspace/api/dist ./api/dist
COPY --from=build --chown=node:node /workspace/app/dist ./app/dist
COPY --from=build --chown=node:node /workspace/infra ./infra
USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","api/dist/main.js"]
