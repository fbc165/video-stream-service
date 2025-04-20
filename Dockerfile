FROM node:18

RUN mkdir /app

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . /app/

EXPOSE 3000

CMD ["node", "server.js"]
