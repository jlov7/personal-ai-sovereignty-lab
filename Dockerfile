FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm verify

EXPOSE 5173

CMD ["pnpm", "dev", "--", "--host", "0.0.0.0"]
