# Use full Node 20 image
FROM node:20

# Set working directory
WORKDIR /app

# Copy ONLY the package files first
COPY package*.json ./

# Run a low-memory, silent install to prevent Render from crashing
RUN npm install --omit=dev --loglevel=error --no-audit --no-fund --legacy-peer-deps

# Copy the rest of the application files (will ignore node_modules due to .dockerignore)
COPY . .

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
