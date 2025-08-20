# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install only prod deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy app
COPY server.js ./server.js
COPY public ./public

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
