FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package info
COPY package*.json ./

# Copy all application files
COPY . .

# Expose server port
EXPOSE 3000

# Set environment defaults
ENV PORT=3000
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# Volume for data persistence
VOLUME ["/app/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "server.js"]
