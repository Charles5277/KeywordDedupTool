FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm store prune && \
    rm -rf node_modules && \
    pnpm install

CMD ["tail", "-f", "/dev/null"]