# Build context is ./website (the Next.js docs/landing site, package "mutka-website").
# Produces a Next.js standalone image (requires output: "standalone" in next.config.mjs).

FROM node:22-alpine AS builder
WORKDIR /app
# Pin pnpm to the version in package.json's packageManager field. NOT @latest:
# pnpm 11 enables the minimumReleaseAge supply-chain guard, which rejects very
# recently published deps and breaks reproducible builds.
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
# Install deps first (cached unless the lockfile changes). --ignore-scripts
# skips the fumadocs-mdx postinstall, which needs source files not copied yet.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# Now that source.config.ts is present, run the fumadocs-mdx generation that the
# postinstall would have done, then build.
RUN pnpm exec fumadocs-mdx && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone output bundles only the files needed to run `node server.js`.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
