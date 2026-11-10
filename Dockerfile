FROM node:24.13.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.13.0-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATA_PROVIDER=supabase
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=20s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health',{headers:{Host:new URL(process.env.APP_ORIGIN).host},signal:AbortSignal.timeout(15000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.mjs"]
