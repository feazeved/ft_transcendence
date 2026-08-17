FROM node:22-bookworm

WORKDIR /app

RUN corepack enable

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]
