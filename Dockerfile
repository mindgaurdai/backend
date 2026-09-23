# Use full Node 20 image (includes all necessary native build toolchains)
FROM node:20

WORKDIR /app

# Copy package manifest
COPY package*.json ./

# Install dependencies cleanly using legacy peer resolution to prevent lockfile conflicts
RUN npm install --legacy-peer-deps

# Copy application source code
COPY . .

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
