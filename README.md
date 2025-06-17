# Documentação da API e Worker de Tradução

---

## 1) Descrição Geral

Este projeto possui dois componentes principais:

- API Express para receber pedidos de tradução.
- Worker que consome a fila RabbitMQ, processa a tradução e atualiza o MongoDB.

A tradução, neste exemplo, é simulada revertendo o texto recebido.

---

## 2) Variáveis de Ambiente

- `MONGO_URI`: string de conexão com o MongoDB.
- `RABBITMQ_URL`: string de conexão com o RabbitMQ.

---

## 3) API REST (Express)

**BASE URL:** `http://localhost:PORT/`

### Rotas:

---

### POST /translations

Enfileira um pedido de tradução.

**Request Body (JSON):**

```json
{
  "text": "Texto a ser traduzido",
  "to": "Código do idioma destino (ex: 'en', 'es')"
}
```

**Respostas:**

- **202 Accepted** (pedido aceito e enfileirado):

```json
{
  "requestId": "uuid-gerado",
  "status": "queued",
  "message": "Tradução enfileirada",
  "_links": {
    "self": { "href": "/translations/uuid-gerado" }
  }
}
```

- **400 Bad Request** (campos faltando):

```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Requisição inválida",
  "status": 400,
  "detail": "Os campos obrigatórios 'text' e 'to' devem ser informados.",
  "missingFields": ["to"],
  "_links": {
    "self": { "href": "/translations" }
  }
}
```

---

### GET /translations/:requestId

Retorna o status e resultado da tradução.

**Resposta sucesso 200 OK:**

```json
{
  "requestId": "uuid",
  "status": "queued|processing|completed|failed",
  "translatedText": "texto traduzido (se disponível)",
  "error": "mensagem de erro (se houver)",
  "createdAt": "data criação",
  "updatedAt": "data atualização",
  "_links": {
    "self": { "href": "/translations/uuid" },
  }
}
```

**Resposta erro 404 Not Found:**

```json
{
  "type": "https://httpstatuses.com/404",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Tradução com requestId 'uuid' não encontrada.",
  "_links": {
    "self": { "href": "/translations/uuid" }
  }
}
```

---

## 4) Worker de Tradução (`translation-worker`)

- Conecta ao MongoDB (`MONGO_URI`).
- Conecta ao RabbitMQ (`RABBITMQ_URL`).
- Consome mensagens da fila `"translations"`.
- Para cada mensagem:
  - Atualiza status para `'processing'`.
  - Simula tradução revertendo o texto.
  - Atualiza o documento com `'completed'` e o texto traduzido.
  - Em caso de erro, atualiza status para `'failed'` com a mensagem do erro.
  - Confirma o processamento da mensagem (`ack`).

Reconexão automática com tentativas e delays em caso de erro na conexão RabbitMQ.

---

## 5) Como rodar

- docker-compose up --build

---

## 6) Código principal resumido

### API POST /translations:

```js
router.post('/', async (req, res) => {
  const { text, to } = req.body;
  // validação e retorno 400 se faltar
  // cria requestId
  // salva no mongo com status queued
  // publica na fila RabbitMQ
  // responde 202 com requestId e links HATEOAS
});
```

### Worker:

```js
async function startWorker() {
  await mongoose.connect(process.env.MONGO_URI);
  const channel = await connectToRabbitMQ();
  channel.consume('translations', async msg => {
    const { requestId, text, to } = JSON.parse(msg.content.toString());
    try {
      await Translation.findOneAndUpdate({ requestId }, { status: 'processing' });
      const translatedText = text.split('').reverse().join('');
      await Translation.findOneAndUpdate({ requestId }, { status: 'completed', translatedText });
    } catch (err) {
      await Translation.findOneAndUpdate({ requestId }, { status: 'failed', error: err.message });
    } finally {
      channel.ack(msg);
    }
  }, { noAck: false });
}
startWorker();
```# translate-rabbitmq
