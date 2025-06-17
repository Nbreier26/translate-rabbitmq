require('dotenv').config();
const mongoose = require('mongoose');
const amqp = require('amqplib');

const Translation = require('./models/Translation');

async function connectToRabbitMQ(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL);

      conn.on('error', err => {
        console.error('Erro na conexão com RabbitMQ:', err.message);
        setTimeout(() => connectToRabbitMQ(), delay);
      });

      conn.on('close', () => {
        console.warn('Conexão com RabbitMQ foi encerrada. Tentando reconectar...');
        setTimeout(() => connectToRabbitMQ(), delay);
      });

      const channel = await conn.createChannel();
      await channel.assertQueue('translations', { durable: true });
      console.log('translation-worker conectado ao RabbitMQ');
      return channel;
    } catch (err) {
      console.warn(`Tentativa ${i + 1} de conexão com RabbitMQ falhou: ${err.message}`);
      if (i === retries - 1) throw new Error('Não foi possível conectar ao RabbitMQ após várias tentativas.');
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

async function startWorker() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('translation-worker conectado ao MongoDB');

  const channel = await connectToRabbitMQ();

  console.log('translation-worker aguardando mensagens na fila...');

  channel.consume(
    'translations',
    async msg => {
      const { requestId, text, to } = JSON.parse(msg.content.toString());
      try {
        await Translation.findOneAndUpdate(
          { requestId },
          { status: 'processing' }
        );

        const translatedText = text.split('').reverse().join('');

        await Translation.findOneAndUpdate(
          { requestId },
          { status: 'completed', translatedText }
        );
      } catch (err) {
        await Translation.findOneAndUpdate(
          { requestId },
          { status: 'failed', error: err.message }
        );
      } finally {
        channel.ack(msg);
      }
    },
    { noAck: false }
  );
}

startWorker().catch(err => {
  console.error('Erro no translation-worker:', err);
  process.exit(1);
});
