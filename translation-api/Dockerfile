FROM node:18-alpine

WORKDIR /usr/src/app

# Copia package.json e instala deps
COPY package.json package-lock.json* ./
RUN npm install --production

# Copia todo o código
COPY . .

# Expondo porta da API
EXPOSE 3000

CMD ["npm", "start"]
