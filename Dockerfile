# Use lightweight Node.js 20 base image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install production dependencies safely
RUN npm install --omit=dev

# Copy rest of application files
COPY . .

# Set default production port
ENV PORT=3000
ENV NODE_ENV=production

# Expose container port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
