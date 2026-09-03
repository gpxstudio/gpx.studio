# BUILD THE PROJECT
FROM node:24-slim AS builder

# Set the working directory for the GPX project
WORKDIR /app/gpx

# Copy the GPX project files
COPY gpx/ ./

# Install and build
RUN npm install && npm run build

# Set the working directory for the website project
WORKDIR /app/website

# Copy the website project files
COPY website/ ./

# Perform a Clean Install
RUN npx ci

# Public env used at build/prerender time (overridable via --build-arg)
ARG PUBLIC_TILES_URL=https://tiles.wanderstories.space
ENV PUBLIC_TILES_URL=$PUBLIC_TILES_URL

# Build the app
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# BUILD THE PRODUCTION IMAGE
FROM node:24-slim AS production

# Set working directory in the production image
WORKDIR /app

# Copy only the built assets from the builders
#COPY --from=builder /app/website/build ./build
#COPY --from=builder /app/website/package*.json ./

# Install only production dependencies
ENV NODE_ENV=production 
#RUN npx ci

# WORKAROUND: Need to install devDependencies as Vite is in devDependencies
COPY --from=builder /app/website/ ./

# Expose the port the server will run on
EXPOSE 4173

# Start the app
CMD ["npm", "run", "preview", "--", "--host", "--port", "4173"]
#CMD ["npx", "serve", "-s", "build", "-l", "4173"]
#CMD ["npx", "vite", "preview", "--host", "--port", "4173"]