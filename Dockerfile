# 1. Use the full Node 20 image to guarantee all build tools are present
FROM node:20

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package manifests safely
COPY package*.json ./

# 4. Force a clean install that ignores strict version conflicts
RUN npm install --legacy-peer-deps

# 5. Copy the remaining server files
COPY . .

# 6. Configure Render environment variables
ENV PORT=3000
ENV NODE_ENV=production

# 7. Expose the port your server listens on
EXPOSE 3000

# 8. Start the Express server
CMD ["node", "server.js"]
