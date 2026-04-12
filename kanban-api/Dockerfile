# Use Node.js 20-alpine as base image
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml* ./

# Install dependencies using pnpm
RUN pnpm install --no-frozen-lockfile

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client for PostgreSQL
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build TypeScript
RUN pnpm run build

# --- Production Stage ---
FROM node:20-alpine

WORKDIR /app

# Install pnpm for production prune if needed
RUN npm install -g pnpm

# Copy built files and node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose API port
EXPOSE 3001

# Start the server
CMD ["node", "dist/index.js"]
