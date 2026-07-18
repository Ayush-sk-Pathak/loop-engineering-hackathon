# Services image: control-plane and procurement run from this one image with a
# per-service command override. No build step at boot — tests and typecheck run
# in CI/locally, never in the container (immutable-image principle).
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/security/package.json packages/security/
COPY services/agent/package.json services/agent/
COPY services/control-plane/package.json services/control-plane/
COPY services/procurement/package.json services/procurement/
COPY services/verification/package.json services/verification/
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY packages packages
COPY services services

RUN mkdir -p /app/data && chown -R node:node /app
USER node

CMD ["npm", "run", "start:control"]
