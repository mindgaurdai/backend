# Use Debian-slim Node 20 base image (resolves Alpine glibc/musl compatibility errors)
FROM node:20-slim

# Set working directory inside the container
WORKDIR /app

# Copy package manifest (wildcard handles with or without package-lock.json)
COPY package*.json ./

# Install dependencies reliably without failing on audit warnings or fund prompts
RUN npm install --no-audit --fund

# Copy remaining application source code
COPY . .

# Set runtime environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Expose backend port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
