# Use lightweight Node.js 20 base image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Explicitly copy ONLY package.json since you do not have a lockfile
COPY package.json ./

# Install dependencies standardly to dynamically generate the tree
RUN npm install

# Copy rest of application files
COPY . .

# Set default production environment
ENV PORT=3000
ENV NODE_ENV=production

# Expose container port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
