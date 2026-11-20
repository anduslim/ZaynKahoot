FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=3000 DATA_DIR=/app/data
# admin edits + uploaded photos; mount persistent storage here
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
