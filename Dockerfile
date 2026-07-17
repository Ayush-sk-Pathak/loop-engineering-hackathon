FROM node:22.22.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/security/package.json packages/security/package.json
COPY services/agent/package.json services/agent/package.json
COPY services/control-plane/package.json services/control-plane/package.json
COPY services/procurement/package.json services/procurement/package.json
COPY services/verification/package.json services/verification/package.json
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
CMD ["npm", "run", "start:control"]
