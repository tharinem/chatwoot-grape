# --- Build Stage ---
FROM node:20-alpine AS builder

# Install pnpm for faster and lighter builds
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml* ./

# Force development mode for install to get Vite and other devDependencies
ENV NODE_ENV=development

# Install all dependencies using pnpm
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the application
COPY . .

# Build argument for the API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build argument for the Chatwoot base URL (used to build links to conversation/contact)
ARG VITE_CHATWOOT_URL
ENV VITE_CHATWOOT_URL=$VITE_CHATWOOT_URL

# Build the production version
RUN pnpm run build

# --- Production Stage ---
FROM nginx:alpine

# Copy the build output to replace the default nginx contents
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
