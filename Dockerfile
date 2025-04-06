# Use an official Node.js runtime as a parent image
# Choose a version compatible with your project (e.g., LTS version)
FROM node:20-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install app dependencies, ignoring scripts (like 'prepare') during install
RUN npm install --ignore-scripts

# Copy tsconfig and source code
COPY tsconfig.json ./
COPY src ./src/

# Now build the project inside the container
RUN npm run build

# Optional: Remove dev dependencies after build
RUN npm prune --production

# Copy compiled code from the 'dist' directory (already built in the previous step)
# COPY dist ./dist # This is not needed as 'npm run build' creates it

# --- Optional: Pruning devDependencies ---
# If you installed all dependencies earlier, prune devDependencies now
# RUN npm prune --production

# --- Runtime Stage ---
# Use a smaller base image for the final stage if possible
FROM node:20-alpine

WORKDIR /app

# Copy production node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules
# Copy compiled code (dist directory) from the builder stage
COPY --from=builder /app/dist ./dist
# Copy package.json for runtime info if needed (e.g., version)
COPY package.json .

# Expose the port the app runs on (if it's a web server, otherwise not needed for stdio MCP)
# EXPOSE 3000

# Define the command to run the app
# This should match your start script or the direct command
CMD ["node", "dist/src/mcp/server.js"]