# Use Debian-slim Node 20 base image
FROM node:20-slim

# Set working directory inside the container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies cleanly without audit or funding prompts
RUN npm install --omit=dev --no-audit --no-fund

# Copy remaining application source code
COPY . .

# Set runtime environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Expose backend port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
