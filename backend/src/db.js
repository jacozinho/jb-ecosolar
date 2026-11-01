import pg from 'pg';

const { Pool } = pg;

const memoryState = {
  leads: [
    {
      id: 1,
      nome: 'João da Silva',
      telefone: '(11) 99999-0001',
      email: 'joao@exemplo.com',
      cidade: 'São Paulo',
      estado: 'SP',
      tipo_imovel: 'Residencial',
      concessionaria: '',
      valor_conta: 520,
      valor_investimento: 18900,
      origem: '',
      status: 'NOVO',
      created_at: '2026-08-23T10:00:00.000Z',
    },
  ],
  simulacoes: [
    {
      id: 1,
      lead_id: 1,
      valor_conta: 520,
      consumo_estimado: 350,
      economia_mensal: 182,
      economia_anual: 2184,
      economia_projetada: 54600,
      potencia_kwp: 4.5,
      investimento_estimado: 18900,
      created_at: '2026-08-23T10:05:00.000Z',
    },
  ],
  configuracoes: [
    { id: 1, parametro: 'tarifa', valor: 1.13, descricao: 'Tarifa média de energia' },
    { id: 2, parametro: 'producao_media_kwh', valor: 1400, descricao: 'Produção média por kWp' },
    { id: 3, parametro: 'fator_perdas', valor: 0.25, descricao: 'Fator de perdas' },
    { id: 4, parametro: 'custo_kwp', valor: 4200, descricao: 'Custo estimado por kWp' },
    { id: 5, parametro: 'vida_util_anos', valor: 25, descricao: 'Vida útil' },
    { id: 6, parametro: 'percentual_minimo_economia', valor: 0.35, descricao: 'Percentual de economia estimada' },
    { id: 7, parametro: 'margem_seguranca', valor: 0.15, descricao: 'Margem de segurança do dimensionamento (0,15 = 15%)' },
    { id: 8, parametro: 'potencia_painel_w', valor: 500, descricao: 'Potência de cada painel (W)' },
    { id: 9, parametro: 'fator_inversor', valor: 0.7, descricao: 'Potência do inversor / potência instalada (kWp)' },
  ],
  opcoesFinanciamento: [],
  notificacoes: [],
};

let databaseType = 'memory';
let pool = null;

const leadColumns = 'id, nome, telefone, email, cidade, estado, tipo_imovel, concessionaria, valor_conta, valor_investimento, origem, status, created_at';

function normalizeLead(lead) {
  return { ...lead, valor_conta: Number(lead.valor_conta || 0), valor_investimento: Number(lead.valor_investimento || 0) };
}

async function initializePostgres() {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL é obrigatória em produção.');
    }
    return;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true },
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        cidade TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'NOVO',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS simulacoes (
        id BIGSERIAL PRIMARY KEY,
        lead_id BIGINT REFERENCES leads(id),
        valor_conta NUMERIC NOT NULL,
        consumo_estimado NUMERIC NOT NULL,
        economia_mensal NUMERIC NOT NULL,
        economia_anual NUMERIC NOT NULL,
        economia_projetada NUMERIC NOT NULL,
        potencia_kwp NUMERIC NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS configuracoes (
        id BIGSERIAL PRIMARY KEY,
        parametro TEXT NOT NULL UNIQUE,
        valor NUMERIC NOT NULL,
        descricao TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS opcoes_financiamento (
        id BIGSERIAL PRIMARY KEY,
        instituicao TEXT NOT NULL,
        taxa_juros_mensal NUMERIC NOT NULL CHECK (taxa_juros_mensal >= 0),
        ativa BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT '';
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS tipo_imovel TEXT NOT NULL DEFAULT '';
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS concessionaria TEXT NOT NULL DEFAULT '';
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_conta NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_investimento NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT '';
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS investimento_estimado NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS payback_meses INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS geracao_mensal_kwh NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS quantidade_paineis INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS potencia_inversor_kw NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS tipo_imovel TEXT NOT NULL DEFAULT '';
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT '';
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS cidade TEXT NOT NULL DEFAULT '';
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS concessionaria TEXT NOT NULL DEFAULT '';
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS prazo_pagamento INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS financiamento_instituicao TEXT NOT NULL DEFAULT '';
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS taxa_juros_mensal NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS valor_pagamento_estimado NUMERIC NOT NULL DEFAULT 0;
      ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS valor_total_pagamento_estimado NUMERIC NOT NULL DEFAULT 0;
      INSERT INTO configuracoes (parametro, valor, descricao) VALUES
        ('tarifa', 1.13, 'Tarifa média de energia'),
        ('producao_media_kwh', 1400, 'Produção média por kWp'),
        ('fator_perdas', 0.25, 'Fator de perdas'),
        ('custo_kwp', 4200, 'Custo estimado por kWp'),
        ('vida_util_anos', 25, 'Vida útil'),
        ('percentual_minimo_economia', 0.35, 'Percentual de economia estimada'),
        ('margem_seguranca', 0.15, 'Margem de segurança do dimensionamento (0,15 = 15%)'),
        ('potencia_painel_w', 500, 'Potência de cada painel (W)'),
        ('fator_inversor', 0.7, 'Potência do inversor / potência instalada (kWp)')
      ON CONFLICT (parametro) DO NOTHING;
    `);
    databaseType = 'postgres';
    console.log('Conexão com PostgreSQL disponível.');
  } catch (error) {
    pool = null;
    if (process.env.NODE_ENV === 'production') {
      databaseType = 'postgres';
      throw error;
    }
    databaseType = 'memory';
    console.warn('PostgreSQL indisponível; usando armazenamento em memória apenas no desenvolvimento.');
  }
}

export async function initDb() {
  await initializePostgres();
  return databaseType;
}

export async function isDatabaseHealthy() {
  if (databaseType !== 'postgres' || !pool) return false;
  await pool.query('SELECT 1');
  return true;
}

export async function getDashboard() {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM simulacoes) AS "totalSimulacoes",
        (SELECT COUNT(*)::int FROM leads) AS "totalLeads",
        (SELECT COUNT(*)::int FROM leads WHERE status <> 'NOVO') AS "leadsConvertidos",
        (SELECT COUNT(*)::int FROM leads WHERE status = 'NOVO') AS novo,
        (SELECT COUNT(*)::int FROM leads WHERE status = 'QUALIFICADO') AS qualificado,
        (SELECT COUNT(*)::int FROM leads WHERE status = 'PROPOSTA ENVIADA') AS proposta,
        (SELECT COUNT(*)::int FROM leads WHERE status = 'CONTRATADO') AS contratado
    `);
    const dashboard = rows[0];
    return {
      totalSimulacoes: dashboard.totalSimulacoes,
      totalLeads: dashboard.totalLeads,
      conversao: dashboard.totalLeads ? Math.round((dashboard.leadsConvertidos / dashboard.totalLeads) * 100) : 0,
      status: { novo: dashboard.novo, qualificado: dashboard.qualificado, proposta: dashboard.proposta, contratado: dashboard.contratado },
    };
  }

  const leads = [...memoryState.leads];
  const simulacoes = [...memoryState.simulacoes];

  return {
    totalSimulacoes: simulacoes.length,
    totalLeads: leads.length,
    conversao: leads.length ? Math.min(100, Math.round((leads.filter((lead) => lead.status !== 'NOVO').length / leads.length) * 100)) : 0,
    status: {
      novo: leads.filter((lead) => lead.status === 'NOVO').length,
      qualificado: leads.filter((lead) => lead.status === 'QUALIFICADO').length,
      proposta: leads.filter((lead) => lead.status === 'PROPOSTA ENVIADA').length,
      contratado: leads.filter((lead) => lead.status === 'CONTRATADO').length,
    },
  };
}

export async function getLeads() {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(`SELECT ${leadColumns} FROM leads ORDER BY created_at DESC`);
    return rows.map(normalizeLead);
  }

  return [...memoryState.leads];
}

export async function getSimulacoes() {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(
      `SELECT id, valor_conta, economia_mensal, economia_anual, potencia_kwp,
              prazo_pagamento, financiamento_instituicao, taxa_juros_mensal,
              valor_pagamento_estimado, valor_total_pagamento_estimado, investimento_estimado,
              payback_meses, geracao_mensal_kwh, quantidade_paineis, potencia_inversor_kw,
              tipo_imovel, estado, cidade, concessionaria, lead_id, created_at
       FROM simulacoes
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    return rows;
  }

  return memoryState.simulacoes.slice(0, 100).map((simulation) => ({ ...simulation }));
}

export async function createLead(payload) {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(
      `INSERT INTO leads (nome, telefone, email, cidade, estado, tipo_imovel, concessionaria, valor_conta, valor_investimento, origem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${leadColumns}`,
      [
        payload.nome, payload.telefone, payload.email || '', payload.cidade || '', payload.estado || '',
        payload.tipo_imovel || '', payload.concessionaria || '', payload.valor_conta || 0,
        payload.valor_investimento || 0, payload.origem || '',
      ],
    );
    return normalizeLead(rows[0]);
  }

  const lead = {
    id: Date.now(),
    nome: payload.nome,
    telefone: payload.telefone,
    email: payload.email || '',
    cidade: payload.cidade || '',
    estado: payload.estado || '',
    tipo_imovel: payload.tipo_imovel || '',
    concessionaria: payload.concessionaria || '',
    valor_conta: Number(payload.valor_conta || 0),
    valor_investimento: Number(payload.valor_investimento || 0),
    origem: payload.origem || '',
    status: 'NOVO',
    created_at: new Date().toISOString(),
  };

  memoryState.leads.unshift(lead);

  return lead;
}

export async function updateLeadStatus(id, status) {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(
      `UPDATE leads SET status = $1 WHERE id = $2 RETURNING ${leadColumns}`,
      [status, id],
    );
    return rows[0] ? normalizeLead(rows[0]) : null;
  }

  const lead = memoryState.leads.find((item) => item.id === Number(id));
  if (!lead) return null;

  lead.status = status;
  return lead;
}

export async function getConfiguracoes() {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query('SELECT id, parametro, valor, descricao FROM configuracoes ORDER BY id');
    return rows;
  }

  return [...memoryState.configuracoes];
}

export async function updateConfiguracao(id, valor) {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(
      'UPDATE configuracoes SET valor = $1 WHERE id = $2 RETURNING id, parametro, valor, descricao',
      [valor, id],
    );
    return rows[0] || null;
  }

  const config = memoryState.configuracoes.find((item) => item.id === Number(id));
  if (!config) return null;

  config.valor = Number(valor);
  return config;
}

export async function getOpcoesFinanciamento() {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(
      'SELECT id, instituicao, taxa_juros_mensal, ativa, updated_at FROM opcoes_financiamento ORDER BY instituicao, id',
    );
    return rows.map((option) => ({ ...option, id: Number(option.id), taxa_juros_mensal: Number(option.taxa_juros_mensal) }));
  }

  return memoryState.opcoesFinanciamento.map((option) => ({ ...option }));
}

export async function criarOpcaoFinanciamento({ instituicao, taxa_juros_mensal }) {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(
      `INSERT INTO opcoes_financiamento (instituicao, taxa_juros_mensal)
       VALUES ($1, $2)
       RETURNING id, instituicao, taxa_juros_mensal, ativa, updated_at`,
      [instituicao, taxa_juros_mensal],
    );
    return { ...rows[0], id: Number(rows[0].id), taxa_juros_mensal: Number(rows[0].taxa_juros_mensal) };
  }

  const option = {
    id: Date.now(),
    instituicao,
    taxa_juros_mensal: Number(taxa_juros_mensal),
    ativa: true,
    updated_at: new Date().toISOString(),
  };
  memoryState.opcoesFinanciamento.push(option);
  return { ...option };
}

export async function atualizarOpcaoFinanciamento(id, { instituicao, taxa_juros_mensal, ativa }) {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(
      `UPDATE opcoes_financiamento
       SET instituicao = $1, taxa_juros_mensal = $2, ativa = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, instituicao, taxa_juros_mensal, ativa, updated_at`,
      [instituicao, taxa_juros_mensal, ativa, id],
    );
    return rows[0] ? { ...rows[0], id: Number(rows[0].id), taxa_juros_mensal: Number(rows[0].taxa_juros_mensal) } : null;
  }

  const option = memoryState.opcoesFinanciamento.find((item) => item.id === Number(id));
  if (!option) return null;
  Object.assign(option, { instituicao, taxa_juros_mensal: Number(taxa_juros_mensal), ativa, updated_at: new Date().toISOString() });
  return { ...option };
}

export async function excluirOpcaoFinanciamento(id) {
  if (databaseType === 'postgres') {
    const { rowCount } = await pool.query('DELETE FROM opcoes_financiamento WHERE id = $1', [id]);
    return rowCount > 0;
  }

  const index = memoryState.opcoesFinanciamento.findIndex((item) => item.id === Number(id));
  if (index < 0) return false;
  memoryState.opcoesFinanciamento.splice(index, 1);
  return true;
}

export async function createSimulation(payload) {
  if (databaseType === 'postgres') {
    const { rows } = await pool.query(
      `INSERT INTO simulacoes (
         lead_id, valor_conta, consumo_estimado, economia_mensal, economia_anual,
         economia_projetada, potencia_kwp, prazo_pagamento, financiamento_instituicao,
         taxa_juros_mensal, valor_pagamento_estimado, valor_total_pagamento_estimado,
         investimento_estimado, payback_meses, geracao_mensal_kwh, quantidade_paineis,
         potencia_inversor_kw, tipo_imovel, estado, cidade, concessionaria
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING id, lead_id, valor_conta, consumo_estimado, economia_mensal, economia_anual,
         economia_projetada, potencia_kwp, prazo_pagamento, financiamento_instituicao,
         taxa_juros_mensal, valor_pagamento_estimado, valor_total_pagamento_estimado,
         investimento_estimado, payback_meses, geracao_mensal_kwh, quantidade_paineis,
         potencia_inversor_kw, tipo_imovel, estado, cidade, concessionaria, created_at`,
      [
        payload.lead_id || null,
        payload.valor_conta,
        payload.consumo_estimado,
        payload.economia_mensal,
        payload.economia_anual,
        payload.economia_projetada,
        payload.potencia_kwp,
        payload.prazo_pagamento,
        payload.financiamento_instituicao,
        payload.taxa_juros_mensal,
        payload.valor_pagamento_estimado,
        payload.valor_total_pagamento_estimado,
        payload.investimento_estimado,
        payload.payback_meses,
        payload.geracao_mensal_kwh,
        payload.quantidade_paineis,
        payload.potencia_inversor_kw,
        payload.tipo_imovel || '',
        payload.estado || '',
        payload.cidade || '',
        payload.concessionaria || '',
      ],
    );
    return rows[0];
  }

  const simulation = {
    id: Date.now(),
    lead_id: payload.lead_id || null,
    valor_conta: Number(payload.valor_conta || 0),
    consumo_estimado: Number(payload.consumo_estimado || 0),
    economia_mensal: Number(payload.economia_mensal || 0),
    economia_anual: Number(payload.economia_anual || 0),
    economia_projetada: Number(payload.economia_projetada || 0),
    potencia_kwp: Number(payload.potencia_kwp || 0),
    prazo_pagamento: Number(payload.prazo_pagamento || 0),
    financiamento_instituicao: payload.financiamento_instituicao || '',
    taxa_juros_mensal: Number(payload.taxa_juros_mensal || 0),
    valor_pagamento_estimado: Number(payload.valor_pagamento_estimado || 0),
    valor_total_pagamento_estimado: Number(payload.valor_total_pagamento_estimado || 0),
    investimento_estimado: Number(payload.investimento_estimado || 0),
    payback_meses: Number(payload.payback_meses || 0),
    geracao_mensal_kwh: Number(payload.geracao_mensal_kwh || 0),
    quantidade_paineis: Number(payload.quantidade_paineis || 0),
    potencia_inversor_kw: Number(payload.potencia_inversor_kw || 0),
    tipo_imovel: payload.tipo_imovel || '',
    estado: payload.estado || '',
    cidade: payload.cidade || '',
    concessionaria: payload.concessionaria || '',
    created_at: new Date().toISOString(),
  };

  memoryState.simulacoes.unshift(simulation);
  return simulation;
}

export async function calculateSimulation(input, financingOption = null) {
  const valorConta = Number(input.valor_conta || 0);
  if (!valorConta) {
    return {
      economia_mensal: 0,
      economia_anual: 0,
      economia_projetada: 0,
      vida_util_anos: 25,
      potencia_kwp: 0,
      quantidade_paineis: 0,
      potencia_painel_w: 0,
      potencia_inversor_kw: 0,
      geracao_mensal_kwh: 0,
      margem_seguranca: 0,
      payback_meses: 0,
      nova_conta_estimada: 0,
      investimento_estimado: 0,
      consumo_estimado: 0,
      prazo_pagamento: Number(input.prazo_pagamento ?? 12),
      financiamento_id: financingOption?.id || null,
      financiamento_instituicao: financingOption?.instituicao || '',
      taxa_juros_mensal: Number(financingOption?.taxa_juros_mensal || 0),
      valor_pagamento_estimado: 0,
      valor_total_pagamento_estimado: 0,
    };
  }

  const configuracoes = await getConfiguracoes();
  const valores = Object.fromEntries(configuracoes.map((config) => [config.parametro, Number(config.valor)]));
  const tarifa = valores.tarifa || 1.13;
  const producaoMediaKwh = valores.producao_media_kwh || 1400;
  const fatorPerdas = valores.fator_perdas || 0.25;
  const vidaUtilAnos = valores.vida_util_anos || 25;
  const percentualEconomia = valores.percentual_minimo_economia || 0.35;
  const custoKwp = valores.custo_kwp || 4200;
  const prazoPagamento = Number(input.prazo_pagamento ?? 12);
  const taxaJurosMensal = prazoPagamento === 0 ? 0 : Number(financingOption?.taxa_juros_mensal || 0);
  const economiaMensal = valorConta * percentualEconomia;
  const economiaAnual = economiaMensal * 12;
  const consumoEstimado = Math.max(1, Math.round(valorConta / tarifa));
  const potenciaBaseKwp = consumoEstimado / ((producaoMediaKwh / 12) * fatorPerdas);
  const potenciaPainelW = valores.potencia_painel_w || 500;
  const margemSeguranca = valores.margem_seguranca ?? 0.15;
  const quantidadePaineis = Math.max(1, Math.ceil((potenciaBaseKwp * (1 + margemSeguranca) * 1000) / potenciaPainelW));
  const potenciaKwp = (quantidadePaineis * potenciaPainelW) / 1000;
  const potenciaInversorKw = Math.max(1, Math.round(potenciaKwp * (valores.fator_inversor || 0.7)));
  const geracaoMensalKwh = Math.round(potenciaKwp * (producaoMediaKwh / 12) * fatorPerdas);
  const investimentoEstimado = Number((potenciaKwp * custoKwp).toFixed(2));
  const paybackMeses = economiaMensal > 0 ? Math.ceil(investimentoEstimado / economiaMensal) : 0;
  const novaContaEstimada = Math.max(0, valorConta - economiaMensal);
  const taxaMensalDecimal = taxaJurosMensal / 100;
  const valorPagamentoEstimado = Number((prazoPagamento === 0
    ? investimentoEstimado
    : taxaMensalDecimal === 0
      ? investimentoEstimado / prazoPagamento
      : investimentoEstimado * taxaMensalDecimal / (1 - (1 + taxaMensalDecimal) ** -prazoPagamento)).toFixed(2));
  const valorTotalPagamentoEstimado = Number((valorPagamentoEstimado * (prazoPagamento || 1)).toFixed(2));
  const economiaProjetada = economiaAnual * vidaUtilAnos;

  return {
    economia_mensal: Number(economiaMensal.toFixed(2)),
    economia_anual: Number(economiaAnual.toFixed(2)),
    economia_projetada: Number(economiaProjetada.toFixed(2)),
    vida_util_anos: vidaUtilAnos,
    potencia_kwp: Number(potenciaKwp.toFixed(2)),
    quantidade_paineis: quantidadePaineis,
    potencia_painel_w: potenciaPainelW,
    potencia_inversor_kw: potenciaInversorKw,
    geracao_mensal_kwh: geracaoMensalKwh,
    margem_seguranca: margemSeguranca,
    payback_meses: paybackMeses,
    nova_conta_estimada: Number(novaContaEstimada.toFixed(2)),
    investimento_estimado: investimentoEstimado,
    consumo_estimado: consumoEstimado,
    prazo_pagamento: prazoPagamento,
    financiamento_id: financingOption?.id || null,
    financiamento_instituicao: financingOption?.instituicao || '',
    taxa_juros_mensal: taxaJurosMensal,
    valor_pagamento_estimado: valorPagamentoEstimado,
    valor_total_pagamento_estimado: valorTotalPagamentoEstimado,
  };
}
