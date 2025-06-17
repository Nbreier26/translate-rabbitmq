require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');

const translationsRouter = require('./routes/translations');

let amqpChannel;

async function connectToRabbitMQ(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL);
      conn.on('error', err => {
        console.error('Erro na conexão com o RabbitMQ:', err.message);
        setTimeout(() => connectToRabbitMQ(), delay); // reconecta
      });
      conn.on('close', () => {
        console.warn('Conexão com o RabbitMQ foi fechada. Tentando reconectar...');
        setTimeout(() => connectToRabbitMQ(), delay);
      });

      const channel = await conn.createChannel();
      await channel.assertQueue('translations', { durable: true });

      console.log('Conectado ao RabbitMQ com sucesso!');
      return channel;
    } catch (err) {
      console.warn(`Tentativa ${i + 1} falhou: ${err.message}`);
      if (i === retries - 1) throw new Error('Falha ao conectar ao RabbitMQ após várias tentativas.');
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado ao MongoDB!');

  amqpChannel = await connectToRabbitMQ();

  const app = express();
  app.use(express.json());

  // Middleware para injetar o canal nas rotas
  app.use((req, res, next) => {
    req.amqpChannel = amqpChannel;
    next();
  });

  app.use('/translations', translationsRouter);

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`translation-api rodando em http://localhost:${port}`);
  });
}

start().catch(err => {
  console.error('Erro ao iniciar translation-api:', err);
  process.exit(1);
});
