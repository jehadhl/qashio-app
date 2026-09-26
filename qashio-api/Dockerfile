FROM node:22

WORKDIR /app

# Install all dependencies (dev ones are needed for ts-node migrations and nest start)
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4000

# Create/upgrade the tables, add the demo account (safe to re-run), then start the API
CMD ["sh", "-c", "npm run migration:run && npm run seed && npm run start:dev"]
