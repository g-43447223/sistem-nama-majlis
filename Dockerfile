# Pelayan Sistem Nama Majlis (Node 24 + SQLite)
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# DATA_DIR & UPLOAD_DIR mesti berada pada volum kekal,
# jika tidak pangkalan data dan gambar akan hilang setiap kali deployment baru.
ENV PORT=3000 \
    AWAN=1 \
    DATA_DIR=/data \
    UPLOAD_DIR=/data/uploads

VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
