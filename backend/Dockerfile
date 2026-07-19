# Use a lightweight Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies first (leverage Docker layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the backend code
COPY . .

# Expose the backend port
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
