# Use lightweight Node.js 20 base image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests first for Docker layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source code and public frontend assets
COPY . .

# Environment variables (PORT default, GEMINI_API_KEY passed at runtime)
ENV PORT=3000
ENV NODE_ENV=production

# Expose backend port
EXPOSE 3000

# Start the MindGuard-AI Express server
CMD ["node", "server.js"]
