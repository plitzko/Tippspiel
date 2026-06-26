# Schlanker, deterministischer Build (umgeht den haengenden Railpack-Image-Schritt)
FROM node:20-alpine

WORKDIR /app

# Nur Manifest zuerst -> Layer-Cache fuer Dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Rest der App
COPY . .

ENV NODE_ENV=production
# Railway setzt PORT selbst; server.js liest process.env.PORT
CMD ["node", "server.js"]
