const express = require('express');
const { v4: uuid } = require('uuid');
const Translation = require('../models/Translation');

const router = express.Router();

// POST /translations
router.post('/', async (req, res) => {
  const { text, to } = req.body;

  // Validação dos campos obrigatórios
  const missingFields = [];
  if (!text) missingFields.push('text');
  if (!to) missingFields.push('to');

  if (missingFields.length > 0) {
    return res.status(400).json({
      type: 'https://httpstatuses.com/400',
      title: 'Requisição inválida',
      status: 400,
      detail: "Os campos obrigatórios 'text' e 'to' devem ser informados.",
      missingFields,
      _links: {
        self: { href: '/translations' }
      }
    });
  }

  const requestId = uuid();

  // 1) Grava no MongoDB
  await Translation.create({ requestId, text, to, status: 'queued' });

  // 2) Publica na fila
  req.amqpChannel.sendToQueue(
    'translations',
    Buffer.from(JSON.stringify({ requestId, text, to })),
    { persistent: true }
  );

  // 3) Responde ao cliente
  return res.status(202).json({
    requestId,
    status: 'queued',
    message: 'Tradução enfileirada',
    _links: {
      self: { href: `/translations/${requestId}` }
    }
  });
});

// GET /translations/:requestId
router.get('/:requestId', async (req, res) => {
  const doc = await Translation.findOne({ requestId: req.params.requestId });

  if (!doc) {
    return res.status(404).json({
      type: 'https://httpstatuses.com/404',
      title: 'Recurso não encontrado',
      status: 404,
      detail: `Tradução com requestId '${req.params.requestId}' não encontrada.`,
      _links: {
        self: { href: `/translations/${req.params.requestId}` }
      }
    });
  }

  return res.json({
    requestId: doc.requestId,
    status: doc.status,
    translatedText: doc.translatedText,
    error: doc.error,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    _links: {
      self: { href: `/translations/${doc.requestId}` },
      retry: { href: `/translations/${doc.requestId}/retry`, method: 'POST' },
    }
  });
});

module.exports = router;
