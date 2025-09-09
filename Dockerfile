FROM node:20-slim AS builder
WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the TypeScript code
RUN npm run build

# Compile seed file to JavaScript
RUN npx tsc prisma/seed.ts --outDir dist/prisma --target es2020 --moduleResolution node

# Stage 2: Production Dependencies
FROM node:20-slim AS production-deps
WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev


# Stage 3: Runtime
FROM node:20-slim
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy necessary files from previous stages
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/docker-entrypoint.js ./docker-entrypoint.js
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# COPY --from=builder /app/.env .env

# Create media directories with proper permissions
RUN mkdir -p /app/dist/media/images /app/dist/media/videos /app/dist/media/audios && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE 3000

# Set working directory again for safety
WORKDIR /app

# Command to run the application with database setup
ENTRYPOINT ["node"]
CMD ["docker-entrypoint.js"]

