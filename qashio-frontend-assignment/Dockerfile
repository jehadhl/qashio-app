# Build stage
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# NestJS URL the browser calls; next.config.js inlines it into the bundle
ARG BACKEND_API_URL=http://localhost:4000/api
ENV BACKEND_API_URL=$BACKEND_API_URL

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built files from build stage
COPY --from=build /app/next.config.js ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./package.json
# JSON file behind the demo /api routes (lib/db.ts)
COPY --from=build /app/data ./data

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"] 