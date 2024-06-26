FROM node:20-alpine AS node

RUN mkdir -p /app && chown node:node /app
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

RUN npm install typescript -g

COPY . .

RUN npm run build

CMD ["node", "./build/index.js"]
