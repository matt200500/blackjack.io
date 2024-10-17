FROM node:18
WORKDIR /app

# We use the * since we will have package.json and package-lock.json
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

EXPOSE 5000

# Start the server with nodemon
CMD ["npx", "nodemon", "server.js"]
