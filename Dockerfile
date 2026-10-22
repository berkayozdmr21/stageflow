FROM node:24-bookworm-slim
WORKDIR /app
ARG STAGEFLOW_API_URL=http://api:9149
ENV STAGEFLOW_API_URL=$STAGEFLOW_API_URL
ENV NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.json ./
RUN npm ci --workspaces=false --ignore-scripts --no-audit --no-fund
RUN npm run build
ENV NODE_ENV=production
CMD ["node","dist/apps/api/src/main.js"]
