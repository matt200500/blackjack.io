FROM node:18
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Make sure to expose port 3001
EXPOSE 3001

# Update the command to use port 3001
CMD ["npx", "nodemon", "server.js"]
