FROM node:22-alpine

# Prisma's schema/migration engine has historically wanted these on musl
# libc (Alpine); cheap to include even if this version doesn't strictly need it.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install dependencies first so this layer is cached across code-only changes.
COPY package.json package-lock.json ./
RUN npm ci

# Rest of the source, then build.
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
