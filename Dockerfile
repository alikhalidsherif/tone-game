# Stage 1: Build the React application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the frontend app
RUN npm run build

# Stage 2: Serve the app with Express/Socket.io
FROM node:18-alpine

WORKDIR /app

# Copy package.json and install PROD dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy the server file
COPY server.js .

# Expose port 3001 (Node server)
EXPOSE 3001

# Start Node server
CMD ["node", "server.js"]