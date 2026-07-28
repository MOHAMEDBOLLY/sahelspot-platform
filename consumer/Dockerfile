FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# public/ is currently empty in the repo, and git doesn't track empty
# directories — it won't exist after a fresh clone. Next.js doesn't
# require it, but the second stage below copies it explicitly, so it
# must exist here regardless of what a given checkout contains.
RUN mkdir -p public

# NEXT_PUBLIC_* variables are inlined into the build output at build time
# (see docs/DEPLOYMENT.md) — must be present before `next build` runs, not
# just at container start.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

FROM node:20-slim

WORKDIR /app

# Same non-root pattern as api/Dockerfile.
RUN useradd --system --no-create-home --shell /usr/sbin/nologin appuser

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

CMD ["npm", "run", "start"]
