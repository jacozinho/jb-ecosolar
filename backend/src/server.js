import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import {
  calculateSimulation,
  createLead,
  criarOpcaoFinanciamento,
  createSimulation,
  excluirOpcaoFinanciamento,
  getConfiguracoes,
  getDashboard,
  getLeads,
  getOpcoesFinanciamento,
  getSimulacoes,
  isDatabaseHealthy,
  initDb,
  atualizarOpcaoFinanciamento,
  updateConfiguracao,
  updateLeadStatus,
} from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((origin) => origin.trim());
const adminUsername = process.env.ADMIN_USERNAME || (process.env.NODE_ENV === 'production' ? '' : 'admin');
const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'jb2025');
const validLeadStatuses = new Set(['NOVO', 'CONTATADO', 'QUALIFICADO', 'PROPOSTA ENVIADA', 'CONTRATADO']);
const validPaymentTerms = new Set([0, ...Array.from({ length: 36 }, (_, index) => index + 1)]);
const failedAdminAttempts = new Map();
const whatsappApiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0';
const whatsappWebhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const whatsappAppSecret = process.env.WHATSAPP_APP_SECRET;
const customerServiceWindowMs = 24 * 60 * 60 * 1000;
let recipientLastInboundAt = 0;

function getWhatsAppConfiguration() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipientPhone = process.env.WHATSAPP_RECIPIENT_PHONE?.replace(/\D/g, '');

  if (!accessToken || !phoneNumberId || !recipientPhone) return null;

  return { accessToken, phoneNumberId, recipientPhone };
}

async function notifyNewSimulation(simulation) {
  const configuration = getWhatsAppConfiguration();
  if (!configuration) {
    console.warn('Notificacao WhatsApp desativada: configure WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_RECIPIENT_PHONE.');
    return { sent: false, reason: 'not_configured' };
  }

  const windowAge = Date.now() - recipientLastInboundAt;
  if (windowAge < 0 || windowAge >= customerServiceWindowMs) {
    return { sent: false, reason: 'outside_customer_service_window' };
  }

  const message = 'Uma nova simulacao foi realizada na aplicacao JB Ecosolar.';

  const response = await fetch(`https://graph.facebook.com/${whatsappApiVersion}/${configuration.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${configuration.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: configuration.recipientPhone,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`WhatsApp API retornou ${response.status}: ${details.slice(0, 500)}`);
  }

  return { sent: true };
}

if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD)) {
  throw new Error('ADMIN_USERNAME e ADMIN_PASSWORD são obrigatórias em produção.');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origem não permitida.'));
  },
}));
app.use(express.json({
  limit: '16kb',
  verify(req, res, buffer) {
    req.rawBody = buffer;
  },
}));

function isNonEmptyString(value, maxLength = 200) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validateLead(payload) {
  if (!isNonEmptyString(payload.nome, 120) || !isNonEmptyString(payload.telefone, 40)) {
    return 'Nome e telefone são obrigatórios.';
  }

  if (payload.email && (!isNonEmptyString(payload.email, 160) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))) {
    return 'E-mail inválido.';
  }

  if (payload.cidade && !isNonEmptyString(payload.cidade, 120)) {
    return 'Cidade inválida.';
  }

  return null;
}

function validateFinitePositive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return `${field} deve ser um número positivo.`;
  }

  return null;
}

function validateFinancingOption(payload) {
  if (!isNonEmptyString(payload.instituicao, 120)) return 'Informe o nome da instituição financiadora.';
  if (typeof payload.taxa_juros_mensal !== 'number' || !Number.isFinite(payload.taxa_juros_mensal) || payload.taxa_juros_mensal < 0 || payload.taxa_juros_mensal > 100) {
    return 'A taxa mensal deve ser um número entre 0 e 100%.';
  }
  return null;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, encodedCredentials] = authorization.split(' ');
  let credentials = '';
  try {
    credentials = scheme === 'Basic' && encodedCredentials ? Buffer.from(encodedCredentials, 'base64').toString('utf8') : '';
  } catch {
    credentials = '';
  }
  const separator = credentials.indexOf(':');
  const username = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);

  const now = Date.now();
  const attempts = failedAdminAttempts.get(req.ip) || { count: 0, blockedUntil: 0 };
  if (attempts.blockedUntil > now) {
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
  }

  if (!adminUsername || !adminPassword || !safeEqual(username, adminUsername) || !safeEqual(password, adminPassword)) {
    const count = attempts.count + 1;
    failedAdminAttempts.set(req.ip, { count, blockedUntil: count >= 5 ? now + 15 * 60 * 1000 : 0 });
    return res.status(401).json({ error: 'Não autorizado' });
  }

  failedAdminAttempts.delete(req.ip);
  return next();
}

app.get('/api/health', asyncHandler(async (req, res) => {
  const databaseHealthy = await isDatabaseHealthy();
  if (!databaseHealthy) {
    return res.status(503).json({ ok: false, error: 'Banco de dados indisponível.' });
  }

  return res.json({ ok: true, message: 'JB Ecosolar API funcionando' });
}));

app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && whatsappWebhookVerifyToken && verifyToken === whatsappWebhookVerifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post('/api/whatsapp/webhook', (req, res) => {
  if (!whatsappAppSecret || !req.rawBody) return res.sendStatus(503);

  const signature = req.get('x-hub-signature-256') || '';
  const expectedSignature = `sha256=${crypto.createHmac('sha256', whatsappAppSecret).update(req.rawBody).digest('hex')}`;
  if (!safeEqual(signature, expectedSignature)) return res.sendStatus(401);

  const configuration = getWhatsAppConfiguration();
  if (configuration) {
    for (const entry of req.body?.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (value?.metadata?.phone_number_id !== configuration.phoneNumberId) continue;

        for (const message of value.messages || []) {
          const sender = String(message.from || '').replace(/\D/g, '');
          const timestamp = Number(message.timestamp) * 1000;
          const age = Date.now() - timestamp;
          if (sender === configuration.recipientPhone && Number.isFinite(timestamp) && age >= 0 && age < customerServiceWindowMs && timestamp > recipientLastInboundAt) {
            recipientLastInboundAt = timestamp;
          }
        }
      }
    }
  }

  return res.sendStatus(200);
});

app.post('/api/simulacoes', asyncHandler(async (req, res) => {
  try {
    const input = req.body || {};
    const validationError = validateFinitePositive(input.valor_conta, 'valor_conta');
    if (validationError) return res.status(400).json({ error: validationError });
    const prazoPagamento = input.prazo_pagamento ?? 0;
    if (!validPaymentTerms.has(prazoPagamento)) {
      return res.status(400).json({ error: 'prazo_pagamento deve ser 0 ou um número entre 1 e 36.' });
    }
    let financingOption = null;
    if (prazoPagamento > 0) {
      if (!Number.isSafeInteger(input.financiamento_id) || input.financiamento_id <= 0) {
        return res.status(400).json({ error: 'Selecione uma instituição para simular o parcelamento.' });
      }
      financingOption = (await getOpcoesFinanciamento()).find((option) => option.id === input.financiamento_id && option.ativa);
      if (!financingOption) return res.status(400).json({ error: 'A opção de financiamento selecionada não está disponível.' });
    }
    const result = await calculateSimulation({ ...input, prazo_pagamento: prazoPagamento }, financingOption);
    const simulation = await createSimulation({ ...input, ...result });
    let notification = { sent: false, reason: 'not_sent' };
    try {
      notification = await notifyNewSimulation(simulation);
    } catch (error) {
      console.error('Falha ao enviar notificacao de nova simulacao pelo WhatsApp:', error.message);
      notification = { sent: false, reason: 'provider_error' };
    }

    res.status(201).json({ simulation, result, notification });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar a simulação' });
  }
}));

app.post('/api/simulacoes/preview', asyncHandler(async (req, res) => {
  const input = req.body || {};
  const validationError = validateFinitePositive(input.valor_conta, 'valor_conta');
  if (validationError) return res.status(400).json({ error: validationError });

  const prazoPagamento = input.prazo_pagamento ?? 0;
  if (!validPaymentTerms.has(prazoPagamento)) {
    return res.status(400).json({ error: 'prazo_pagamento deve ser 0, 1 a 36 parcelas.' });
  }

  let financingOption = null;
  if (prazoPagamento > 0) {
    if (!Number.isSafeInteger(input.financiamento_id) || input.financiamento_id <= 0) {
      return res.status(400).json({ error: 'Selecione uma instituição para calcular as parcelas.' });
    }
    financingOption = (await getOpcoesFinanciamento()).find((option) => option.id === input.financiamento_id && option.ativa);
    if (!financingOption) return res.status(400).json({ error: 'A opção de financiamento selecionada não está disponível.' });
  }

  const result = await calculateSimulation({ valor_conta: input.valor_conta, prazo_pagamento: prazoPagamento }, financingOption);
  return res.json({ result });
}));

app.post('/api/leads', asyncHandler(async (req, res) => {
  try {
    const input = req.body || {};
    const validationError = validateLead(input);
    if (validationError) return res.status(400).json({ error: validationError });
    const lead = await createLead(input);
    res.status(201).json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar lead' });
  }
}));

app.get('/api/leads', requireAdmin, asyncHandler(async (req, res) => {
  const leads = await getLeads();
  return res.json(leads);
}));

app.get('/api/simulacoes', requireAdmin, asyncHandler(async (req, res) => {
  return res.json(await getSimulacoes());
}));

app.get('/api/public/dashboard', asyncHandler(async (req, res) => {
  const { totalSimulacoes, totalLeads, conversao } = await getDashboard();
  return res.json({ totalSimulacoes, totalLeads, conversao });
}));

app.get('/api/public/financiamentos', asyncHandler(async (req, res) => {
  const options = await getOpcoesFinanciamento();
  return res.json(options
    .filter((option) => option.ativa)
    .map(({ id, instituicao, taxa_juros_mensal }) => ({ id, instituicao, taxa_juros_mensal })));
}));

app.get('/api/financiamentos', requireAdmin, asyncHandler(async (req, res) => {
  return res.json(await getOpcoesFinanciamento());
}));

app.post('/api/financiamentos', requireAdmin, asyncHandler(async (req, res) => {
  const input = req.body || {};
  const validationError = validateFinancingOption(input);
  if (validationError) return res.status(400).json({ error: validationError });
  const option = await criarOpcaoFinanciamento({
    instituicao: input.instituicao.trim(),
    taxa_juros_mensal: input.taxa_juros_mensal,
  });
  return res.status(201).json({ option });
}));

app.patch('/api/financiamentos/:id', requireAdmin, asyncHandler(async (req, res) => {
  const input = req.body || {};
  const validationError = validateFinancingOption(input);
  if (validationError) return res.status(400).json({ error: validationError });
  if (typeof input.ativa !== 'boolean') return res.status(400).json({ error: 'Informe se a opção está ativa.' });
  const option = await atualizarOpcaoFinanciamento(req.params.id, {
    instituicao: input.instituicao.trim(),
    taxa_juros_mensal: input.taxa_juros_mensal,
    ativa: input.ativa,
  });
  if (!option) return res.status(404).json({ error: 'Opção de financiamento não encontrada.' });
  return res.json({ option });
}));

app.delete('/api/financiamentos/:id', requireAdmin, asyncHandler(async (req, res) => {
  const deleted = await excluirOpcaoFinanciamento(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Opção de financiamento não encontrada.' });
  return res.sendStatus(204);
}));

app.patch('/api/leads/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (!validLeadStatuses.has(req.body?.status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }
  const lead = await updateLeadStatus(req.params.id, req.body.status);
  if (!lead) {
    return res.status(404).json({ error: 'Lead não encontrado' });
  }

  return res.json({ lead });
}));

app.get('/api/dashboard', requireAdmin, asyncHandler(async (req, res) => {
  const dashboard = await getDashboard();
  res.json(dashboard);
}));

app.get('/api/configuracoes', requireAdmin, asyncHandler(async (req, res) => {
  const configuracoes = await getConfiguracoes();
  res.json(configuracoes);
}));

app.patch('/api/configuracoes/:id', requireAdmin, asyncHandler(async (req, res) => {
  const validationError = validateFinitePositive(req.body?.valor, 'valor');
  if (validationError) return res.status(400).json({ error: validationError });
  const config = await updateConfiguracao(req.params.id, req.body.valor);
  if (!config) {
    return res.status(404).json({ error: 'Configuração não encontrada' });
  }

  return res.json({ config });
}));

await initDb();

app.use((error, req, res, next) => {
  if (error.message === 'Origem não permitida.') {
    return res.status(403).json({ error: error.message });
  }

  if (error.type === 'entity.too.large' || error instanceof SyntaxError) {
    return res.status(400).json({ error: 'Requisição inválida.' });
  }

  console.error(error);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
