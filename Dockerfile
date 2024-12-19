FROM node:18

# 安裝 pnpm
RUN npm install -g pnpm

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

CMD ["tail", "-f", "/dev/null"]