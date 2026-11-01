"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { api, type Dashboard, type FinancingOption, type ProposalContext, type SimulationResult } from "@/lib/api";

const estados = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const tiposImovel = ["Residencial", "Comercial", "Industrial", "Rural"];
const concessionarias = ["COPEL", "CEMIG", "CPFL", "Enel", "Light", "Energisa", "Neoenergia", "Equatorial", "CELESC", "RGE", "Elektro"];
const currency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatPayback(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
  if (rest > 0 || years === 0) parts.push(`${rest} ${rest === 1 ? "mês" : "meses"}`);
  return parts.join(" e ");
}

function parseCurrencyInput(value: string) {
  const normalized = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!normalized) return null;

  const usesCommaDecimal = normalized.includes(",");
  const validFormat = usesCommaDecimal
    ? /^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(normalized)
    : /^\d+(?:\.\d{1,2})?$/.test(normalized);
  if (!validFormat) return null;

  const amount = Number(usesCommaDecimal ? normalized.replace(/\./g, "").replace(",", ".") : normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export default function Home() {
  const [valorContaInput, setValorContaInput] = useState("520,00");
  const [leadForm, setLeadForm] = useState({ nome: "", telefone: "", email: "", tipo_imovel: "Residencial", estado: "", cidade: "", concessionaria: "" });
  const [proposta, setProposta] = useState<{ result: SimulationResult; context: ProposalContext; valorConta: number; createdAt: string } | null>(null);
  const [marca, setMarca] = useState<{ empresa: string; cor: string }>({ empresa: "", cor: "" });
  const [prazoPagamento, setPrazoPagamento] = useState(0);
  const [opcoesFinanciamento, setOpcoesFinanciamento] = useState<Omit<FinancingOption, "ativa" | "updated_at">[]>([]);
  const [financiamentoId, setFinanciamentoId] = useState<number | null>(null);
  const [previa, setPrevia] = useState<{ key: string; result: SimulationResult } | null>(null);
  const [erroPrevia, setErroPrevia] = useState<{ key: string; message: string } | null>(null);
  const [simulacaoSalva, setSimulacaoSalva] = useState<{ key: string; createdAt: string } | null>(null);
  const [salvandoSimulacao, setSalvandoSimulacao] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [notificacao, setNotificacao] = useState("Simulação pronta para análise comercial.");
  const valorConta = parseCurrencyInput(valorContaInput);
  const valorContaInvalido = valorConta === null;
  const previewKey = `${valorContaInput}:${prazoPagamento}:${financiamentoId ?? "avista"}`;
  const resultadoExibido = previa?.key === previewKey ? previa.result : null;
  const erroPreviaAtual = erroPrevia?.key === previewKey ? erroPrevia.message : null;
  const previaEmCarregamento = !resultadoExibido && !erroPreviaAtual && !(prazoPagamento > 0 && financiamentoId === null);
  const simulacaoSalvaAtual = simulacaoSalva?.key === previewKey ? simulacaoSalva.createdAt : null;
  const vidaUtilAnos = resultadoExibido?.vida_util_anos ?? 25;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const empresa = (params.get("empresa") || "").slice(0, 60);
    const cor = params.get("cor") || "";
    setMarca({ empresa, cor: /^[0-9a-fA-F]{6}$/.test(cor) ? `#${cor}` : "" });
  }, []);

  useEffect(() => {
    let active = true;
    api.getPublicDashboard()
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch(() => {
        if (active) setDashboard(null);
      });
    api.getPublicFinancingOptions()
      .then((options) => {
        if (!active) return;
        setOpcoesFinanciamento(options);
        setFinanciamentoId(options[0]?.id ?? null);
      })
      .catch(() => {
        if (active) setOpcoesFinanciamento([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (valorConta === null) return;
    if (prazoPagamento > 0 && financiamentoId === null) return;

    const timer = window.setTimeout(() => {
      api.previewSimulation(valorConta, prazoPagamento, financiamentoId)
        .then(({ result }) => {
          if (active) setPrevia({ key: previewKey, result });
        })
        .catch(() => {
          if (active) setErroPrevia({ key: previewKey, message: "Não foi possível calcular a prévia. Verifique sua conexão e tente novamente." });
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [valorConta, prazoPagamento, financiamentoId, previewKey]);

  const handleSimular = async () => {
    if (valorConta === null) {
      setNotificacao("Informe um valor de conta maior que R$ 0,00 para simular.");
      return;
    }
    if (prazoPagamento > 0 && financiamentoId === null) {
      setNotificacao("Selecione uma instituição financiadora para calcular as parcelas.");
      return;
    }
    if (!resultadoExibido) {
      setNotificacao(erroPreviaAtual || "A prévia ainda está sendo calculada. Aguarde um instante e tente novamente.");
      return;
    }
    if (!leadForm.nome.trim() || !leadForm.telefone.trim() || !leadForm.email.trim() || !leadForm.estado || !leadForm.cidade.trim() || !leadForm.concessionaria.trim()) {
      setNotificacao("Preencha nome, e-mail, WhatsApp, estado, cidade e concessionária para gerar a proposta.");
      return;
    }

    setSalvandoSimulacao(true);
    try {
      const context: ProposalContext = { ...leadForm, origem: marca.empresa };
      const { simulation, result } = await api.createSimulation(valorConta, prazoPagamento, financiamentoId, context);
      setPrevia({ key: previewKey, result });
      setSimulacaoSalva({ key: previewKey, createdAt: simulation.created_at });
      setProposta({ result, context, valorConta, createdAt: simulation.created_at });
      api.getPublicDashboard().then(setDashboard).catch(() => setDashboard(null));
      setNotificacao(`Proposta gerada em ${new Date(simulation.created_at).toLocaleString("pt-BR")}.`);
      window.setTimeout(() => document.getElementById("proposta")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setNotificacao("Não foi possível gerar a proposta. Verifique os dados e tente novamente.");
    } finally {
      setSalvandoSimulacao(false);
    }
  };

  const handleNovaCotacao = () => {
    setProposta(null);
    setSimulacaoSalva(null);
    setValorContaInput("");
    setLeadForm({ nome: "", telefone: "", email: "", tipo_imovel: "Residencial", estado: "", cidade: "", concessionaria: "" });
    setNotificacao("Preencha os dados para uma nova cotação.");
    document.getElementById("valor-conta")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleContratar = () => {
    if (!proposta) return;
    const { result, context } = proposta;
    const text = `Olá! Sou ${context.nome} (${context.cidade}/${context.estado}) e quero contratar o sistema solar de ${result.potencia_kwp.toFixed(2)} kWp (investimento estimado ${currency(result.investimento_estimado)}).`;
    const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const brandStyle = marca.cor ? ({ "--primary": marca.cor, "--accent": marca.cor } as CSSProperties) : undefined;

  return (
    <main className="page-shell" style={brandStyle}>
      <header className="brand-bar">
        <img src="/logo-jbecosolar.png" alt="JB Ecosolar" className="brand-logo" />
        {marca.empresa && <strong className="brand-company">{marca.empresa}</strong>}
      </header>

      <nav className="top-nav" aria-label="Navegação principal">
        <a href="/admin">Acessar painel administrativo</a>
      </nav>

      <section className="client-module">
        <section className="metric-bar customer-metrics">
          <div>
            <span>Simulações</span>
            <strong>{dashboard?.totalSimulacoes.toLocaleString("pt-BR") ?? "—"}</strong>
          </div>
          <div>
            <span>Leads</span>
            <strong>{dashboard?.totalLeads.toLocaleString("pt-BR") ?? "—"}</strong>
          </div>
          <div>
            <span>Conversão</span>
            <strong>{dashboard ? `${dashboard.conversao}%` : "—"}</strong>
          </div>
        </section>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">ENERGIA SOLAR PARA SUA ROTINA</p>
            <h1>Uma conta de energia mais leve começa <span>com o sol.</span></h1>
            <p className="subtitle">
              Simule sua economia com um projeto fotovoltaico para sua casa, empresa ou propriedade rural. Você pode reduzir em até <strong>95%</strong> o valor da conta.
            </p>
            <a className="hero-link" href="#valor-conta">Conheça sua economia estimada.</a>
          </div>

          <div className="simulator-card">
            <label htmlFor="valor-conta">Digite o valor da sua conta de energia</label>
            <div className="bill-amount-field" aria-invalid={valorContaInvalido}>
              <span aria-hidden="true">R$</span>
              <input
                id="valor-conta"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Ex.: 520,00"
                value={valorContaInput}
                onChange={(event) => setValorContaInput(event.target.value)}
                aria-invalid={valorContaInvalido}
                aria-describedby="valor-conta-ajuda valor-conta-erro"
              />
            </div>
            <p className="bill-amount-help" id="valor-conta-ajuda">Informe o valor mensal que aparece na sua fatura.</p>
            {valorContaInvalido && (
              <p className="bill-amount-error" id="valor-conta-erro" role="status">
                Digite um valor maior que R$ 0,00. Exemplo: 520,00.
              </p>
            )}
            <fieldset className="proposal-fields">
              <legend>Dados para a proposta personalizada</legend>
              <label htmlFor="tipo-imovel">Tipo de imóvel</label>
              <select id="tipo-imovel" value={leadForm.tipo_imovel} onChange={(event) => setLeadForm({ ...leadForm, tipo_imovel: event.target.value })}>
                {tiposImovel.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
              <label htmlFor="estado">Estado</label>
              <select id="estado" value={leadForm.estado} onChange={(event) => setLeadForm({ ...leadForm, estado: event.target.value })}>
                <option value="">Selecione</option>
                {estados.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
              <label htmlFor="cidade">Cidade</label>
              <input id="cidade" type="text" maxLength={120} value={leadForm.cidade} onChange={(event) => setLeadForm({ ...leadForm, cidade: event.target.value })} />
              <label htmlFor="concessionaria">Concessionária de energia</label>
              <input id="concessionaria" type="text" list="lista-concessionarias" maxLength={120} value={leadForm.concessionaria} onChange={(event) => setLeadForm({ ...leadForm, concessionaria: event.target.value })} />
              <datalist id="lista-concessionarias">
                {concessionarias.map((nome) => <option key={nome} value={nome} />)}
              </datalist>
              <label htmlFor="nome">Nome completo</label>
              <input id="nome" type="text" autoComplete="name" maxLength={120} value={leadForm.nome} onChange={(event) => setLeadForm({ ...leadForm, nome: event.target.value })} />
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" autoComplete="email" maxLength={160} value={leadForm.email} onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })} />
              <label htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" type="tel" autoComplete="tel" maxLength={40} value={leadForm.telefone} onChange={(event) => setLeadForm({ ...leadForm, telefone: event.target.value })} />
            </fieldset>
            <section className="payment-selection" aria-labelledby="payment-heading">
              <h2 id="payment-heading">Opções de pagamento. </h2>
              <p>
                Escolha uma opção para incluir na simulação. Confira o item{" "}
                <a
                  href="#detalhes-simulacao-pagamento"
                  onClick={() => {
                    const details = document.getElementById("detalhes-simulacao-pagamento");
                    if (details instanceof HTMLDetailsElement) details.open = true;
                  }}
                >
                  Detalhes da simulação e pagamento
                </a>{" "}
                para mais informações.
              </p>
              <fieldset className="payment-options">
                <legend className="visually-hidden">Selecione pagamento à vista ou parcelado</legend>
                <label className="payment-option">
                  <input
                    type="radio"
                    name="modo-pagamento"
                    value="avista"
                    checked={prazoPagamento === 0}
                    onChange={() => setPrazoPagamento(0)}
                  />
                  <span>
                    <strong>À vista</strong>
                    <small>Pagamento único</small>
                  </span>
                </label>
                <label className="payment-option">
                  <input
                    type="radio"
                    name="modo-pagamento"
                    value="parcelado"
                    checked={prazoPagamento > 0}
                    disabled={opcoesFinanciamento.length === 0}
                    onChange={(event) => setPrazoPagamento(event.target.checked ? Math.max(prazoPagamento, 1) : 0)}
                  />
                  <span>
                    <strong>Parcelamento</strong>
                    <small>{opcoesFinanciamento.length > 0 ? "Taxa da instituição selecionada" : "Requer taxa cadastrada"}</small>
                  </span>
                </label>
              </fieldset>
              {prazoPagamento > 0 && (
                <div className="financing-selection">
                  {opcoesFinanciamento.length > 0 ? (
                    <>
                      <label htmlFor="financiamento-opcao">Instituição e taxa mensal</label>
                      <select
                        id="financiamento-opcao"
                        value={financiamentoId ?? ""}
                        onChange={(event) => setFinanciamentoId(event.target.value ? Number(event.target.value) : null)}
                      >
                        {opcoesFinanciamento.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.instituicao} — {option.taxa_juros_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% a.m.
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <p>Parcelamento indisponível no momento. As opções serão exibidas quando houver taxas cadastradas.</p>
                  )}
                  <label htmlFor="prazo-pagamento">Quantidade de parcelas</label>
                  <select
                    id="prazo-pagamento"
                    value={prazoPagamento}
                    onChange={(event) => setPrazoPagamento(Number(event.target.value))}
                  >
                    {Array.from({ length: 36 }, (_, index) => index + 1).map((term) => (
                      <option key={term} value={term}>{term} {term === 1 ? "parcela" : "parcelas"}</option>
                    ))}
                  </select>
                </div>
              )}
            </section>
            {resultadoExibido ? (
              <>
                <div className="result-grid">
                  <div>
                    <span>Economia mensal estimada</span>
                    <strong>R$ {resultadoExibido.economia_mensal.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div>
                    <span>Economia anual estimada</span>
                    <strong>R$ {resultadoExibido.economia_anual.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div>
                    <span>Potência estimada</span>
                    <strong>{resultadoExibido.potencia_kwp.toFixed(2)} kWp</strong>
                  </div>
                  <div>
                    <span>Economia acumulada em {vidaUtilAnos} anos</span>
                    <strong>R$ {resultadoExibido.economia_projetada.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div>
                    <span>Valor do sistema à vista</span>
                    <strong>R$ {resultadoExibido.investimento_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                    <small>Antes dos encargos de financiamento</small>
                  </div>
                </div>
                <p className="result-context">
                  Estes valores são estimativas: a economia anual é a projeção para 12 meses, e o acumulado considera a vida útil configurada de {vidaUtilAnos} anos.
                </p>
                <section className="payment-summary" aria-live="polite" aria-label="Prévia do pagamento">
                  <span className="payment-summary-label">
                    {prazoPagamento === 0 ? "Pagamento à vista estimado" : `Parcela mensal estimada · ${prazoPagamento}x`}
                  </span>
                  <strong>R$ {resultadoExibido.valor_pagamento_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                  {prazoPagamento > 0 && (
                    <span className="payment-summary-detail">
                      Total em {prazoPagamento} parcelas: R$ {resultadoExibido.valor_total_pagamento_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · {resultadoExibido.financiamento_instituicao}, {resultadoExibido.taxa_juros_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% a.m.
                    </span>
                  )}
                  <span className="payment-summary-pending">
                    {simulacaoSalvaAtual
                      ? `Simulação registrada em ${new Date(simulacaoSalvaAtual).toLocaleString("pt-BR")}.`
                      : "Prévia calculada automaticamente; ainda não registrada."}
                  </span>
                </section>
                <details className="payment-estimate" id="detalhes-simulacao-pagamento">
                  <summary>Detalhes da simulação e pagamento</summary>
                  <p className="payment-disclaimer">
                    A taxa mensal é cadastrada manualmente pelo administrador com base nas informações da instituição financeira e serve apenas como referência para esta simulação. O cálculo considera o valor financiado, a taxa informada e o prazo; não é uma proposta de crédito nem representa o CET. Não inclui IOF, tarifas, seguros ou entrada. Confirme a taxa vigente, o CET e as condições finais diretamente com a instituição antes de contratar.
                  </p>
                  <details className="simulation-methodology">
                    <summary>Como calculamos esta estimativa?</summary>
                    <p>
                      Com base em uma conta de R$ {valorConta?.toLocaleString("pt-BR") ?? "—"}, estimamos um consumo de {resultadoExibido.consumo_estimado.toLocaleString("pt-BR")} kWh por mês e uma potência de {resultadoExibido.potencia_kwp.toFixed(2)} kWp para o sistema solar.
                    </p>
                    <p>
                      A economia considera a tarifa de energia, a produção solar média e as perdas técnicas do sistema. A proposta final depende da análise do local de instalação e do seu perfil de consumo.
                    </p>
                  </details>
                </details>
              </>
            ) : (
              <section className="payment-summary" aria-live="polite" aria-label="Prévia do pagamento">
                <span className="payment-summary-pending" role="status">
                  {erroPreviaAtual || (prazoPagamento > 0 && financiamentoId === null
                    ? "Selecione uma instituição para calcular as parcelas."
                    : previaEmCarregamento
                      ? "Calculando sua estimativa…"
                      : "A prévia não está disponível. Tente novamente.")}
                </span>
              </section>
            )}
            <div className="simulator-actions">
              <button type="button" onClick={handleSimular} className="simulator-action" disabled={!resultadoExibido || salvandoSimulacao}>
                {salvandoSimulacao ? "Gerando proposta…" : simulacaoSalvaAtual ? "Gerar nova proposta" : "Gerar proposta"}
              </button>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <p className="status-message" role="status">{notificacao}</p>
        </section>

        {proposta && (
          <section className="panel proposal" id="proposta" aria-labelledby="proposta-titulo">
            <h2 id="proposta-titulo">Proposta para {proposta.context.nome}</h2>
            <p className="proposal-subtitle">
              {proposta.context.tipo_imovel} em {proposta.context.cidade}/{proposta.context.estado} · {proposta.context.concessionaria} · {new Date(proposta.createdAt).toLocaleDateString("pt-BR")}
            </p>
            <div className="result-grid">
              <div><span>Investimento estimado</span><strong>{currency(proposta.result.investimento_estimado)}</strong></div>
              <div><span>Economia mensal</span><strong>{currency(proposta.result.economia_mensal)}</strong></div>
              <div><span>Geração estimada</span><strong>{proposta.result.geracao_mensal_kwh.toLocaleString("pt-BR")} kWh/mês</strong></div>
              <div><span>Retorno do investimento (payback)</span><strong>{formatPayback(proposta.result.payback_meses)}</strong></div>
            </div>
            <h3>Sistema dimensionado</h3>
            <p>
              Projeto com margem de segurança de {Math.round(proposta.result.margem_seguranca * 100)}%: {proposta.result.quantidade_paineis} painéis solares de {proposta.result.potencia_painel_w} W, totalizando {proposta.result.potencia_kwp.toFixed(2)} kWp, com inversor String de {proposta.result.potencia_inversor_kw} kW.
            </p>
            <h3>Economia na ponta do lápis</h3>
            <div className="result-grid">
              <div><span>Fatura atual</span><strong>{currency(proposta.valorConta)}</strong></div>
              <div><span>Fatura estimada com energia solar</span><strong>{currency(proposta.result.nova_conta_estimada)}</strong></div>
              <div><span>Economia anual</span><strong>{currency(proposta.result.economia_anual)}</strong></div>
            </div>
            <p className="result-context">
              Valores aproximados, considerando apenas a taxa básica de disponibilidade cobrada pela concessionária.
            </p>
            <div className="proposal-actions">
              <button type="button" className="simulator-action" onClick={() => window.print()}>Gerar PDF</button>
              <button type="button" className="simulator-action" onClick={handleContratar}>Contratar Agora</button>
              <button type="button" className="simulator-action secondary" onClick={handleNovaCotacao}>Nova Cotação</button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
