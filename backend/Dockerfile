FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy encrypted backend
COPY src/ ./src/
COPY key.bin iv.bin ./

# Decrypt và chạy
COPY decrypt-run.js ./
CMD ["node", "decrypt-run.js"]
