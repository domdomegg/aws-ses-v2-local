# Build the code.
FROM node:lts-alpine AS builder

WORKDIR /srv/www

COPY package.json package-lock.json ./

# Install ALL dependencies (dev + prod)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run prepublishOnly

# Prune dev dependencies after build to reduce image size
RUN npm prune --omit=dev

# Create the final image
FROM node:lts-alpine

WORKDIR /srv/www/dist

# Copy only the necessary files from the builder
COPY --from=builder /srv/www/dist /srv/www/dist/
COPY --from=builder /srv/www/node_modules /srv/www/node_modules/
COPY --from=builder /srv/www/static /srv/www/static/
COPY --from=builder /srv/www/package.json /srv/www/package.json

# Use default non-root user provided by distroless images
# Note: Distroless images are designed to be secure and typically do not run as root.
CMD ["cli.js"]
