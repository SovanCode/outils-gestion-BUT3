FROM node:20-alpine

WORKDIR /app

# Optimisation du cache Docker pour les dépendances
COPY package*.json ./
RUN npm install --production

# Copie des sources de l'application
COPY . .

EXPOSE 5000

CMD ["npm", "start"]

