# Build the code.
FROM node:alpine as builder

WORKDIR /srv/www

COPY package.json package-lock.json ./

# Install only production dependencies to reduce image size
RUN npm ci --omit=dev

# Copy the rest of the application files
COPY . .

# Build the application
RUN npm run prepublishOnly

# Create the final image.
FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /srv/www

# Copy only the necessary files from the builder
COPY --from=builder /srv/www/branding /srv/www/branding/
COPY --from=builder /srv/www/dist /srv/www/dist/
COPY --from=builder /srv/www/node_modules /srv/www/node_modules/
COPY --from=builder /srv/www/static /srv/www/static/
COPY --from=builder /srv/www/package.json /srv/www/package.json

# Use default non-root user provided by distroless images
# Note: Distroless images are designed to be secure and typically do not run as root.

CMD ["dist/index.js"]
