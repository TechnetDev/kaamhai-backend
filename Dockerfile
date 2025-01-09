FROM node:20-alpine

WORKDIR /app

# Install app dependencies
COPY package.json package.json

RUN npm install

# Bundle app source
COPY . .

CMD ["node", "backend/server.js"]
