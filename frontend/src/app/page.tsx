"use client";

import { useEffect, useState } from "react";
import { api, type Dashboard, type FinancingOption, type SimulationResult } from "@/lib/api";

export default function Home() {
  const [valorConta, setValorConta] = useState(520);
  const [leadForm, setLeadForm] = useState({ nome: "", telefone: "", email: "", cidade: "" });
  const [prazoPagamento, setPrazoPagamento] = useState(0);
  const [opcoesFinanciamento, setOpcoesFinanciamento] = useState<Omit<FinancingOption, "ativa" | "updated_at">[]>([]);
  const [financiamentoId, setFinanciamentoId] = useState<number | null>(null);
  const [previa, setPrevia] = useState<{ key: string; result: SimulationResult } | null>(null);
  const [erroPrevia, setErroPrevia] = useState<{ key: string; message: string } | null>(null);
  const [simulacaoSalva, setSimulacaoSalva] = useState<{ key: string; createdAt: string } | null>(null);
  const [salvandoSimulacao, setSalvandoSimulacao] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [notificacao, setNotificacao] = useState("Simulação pronta para análise comercial.");
  const previewKey = `${valorConta}:${prazoPagamento}:${financiamentoId ?? "avista"}`;
  const resultadoExibido = previa?.key === previewKey ? previa.result : null;
  const erroPreviaAtual = erroPrevia?.key === previewKey ? erroPrevia.message : null;
  const previaEmCarregamento = !resultadoExibido && !erroPreviaAtual && !(prazoPagamento > 0 && financiamentoId === null);
  const simulacaoSalvaAtual = simulacaoSalva?.key === previewKey ? simulacaoSalva.createdAt : null;

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
    if (prazoPagamento > 0 && financiamentoId === null) {
      setNotificacao("Selecione uma instituição financiadora para calcular as parcelas.");
      return;
    }
    if (!resultadoExibido) {
      setNotificacao(erroPreviaAtual || "A prévia ainda está sendo calculada. Aguarde um instante e tente novamente.");
      return;
    }

    setSalvandoSimulacao(true);
    try {
      const { simulation, result } = await api.createSimulation(valorConta, prazoPagamento, financiamentoId);
      setPrevia({ key: previewKey, result });
      setSimulacaoSalva({ key: previewKey, createdAt: simulation.created_at });
      api.getPublicDashboard().then(setDashboard).catch(() => setDashboard(null));
      setNotificacao(`Simulação registrada em ${new Date(simulation.created_at).toLocaleString("pt-BR")}.`);
    } catch {
      setNotificacao("Não foi possível realizar a simulação. Tente novamente.");
    } finally {
      setSalvandoSimulacao(false);
    }
  };

  const handleLeadSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leadForm.nome || !leadForm.telefone) {
      setNotificacao("Preencha nome e WhatsApp para registrar o lead.");
      return;
    }

    try {
      await api.createLead(leadForm);
      api.getPublicDashboard().then(setDashboard).catch(() => setDashboard(null));
      setNotificacao(`Lead registrado com sucesso para ${leadForm.nome}.`);
      setLeadForm({ nome: "", telefone: "", email: "", cidade: "" });
    } catch {
      setNotificacao("Não foi possível registrar o lead. Tente novamente.");
    }
  };

  return (
    <main className="page-shell">
      <header className="brand-bar">
        <img src="/logo-jbecosolar.png" alt="JB Ecosolar" className="brand-logo" />
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
            <label htmlFor="valor-conta">Valor médio da conta de energia</label>
            <input
              id="valor-conta"
              type="range"
              min={150}
              max={2500}
              step={10}
              value={valorConta}
              onChange={(event) => setValorConta(Number(event.target.value))}
            />
            <div className="price-box">
              <span>Conta mensal</span>
              <strong>R$ {valorConta.toLocaleString("pt-BR")}</strong>
            </div>
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
                    <span>Economia mensal</span>
                    <strong>R$ {resultadoExibido.economia_mensal.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div>
                    <span>Economia anual</span>
                    <strong>R$ {resultadoExibido.economia_anual.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div>
                    <span>Potência estimada</span>
                    <strong>{resultadoExibido.potencia_kwp.toFixed(2)} kWp</strong>
                  </div>
                  <div>
                    <span>Economia acumulada</span>
                    <strong>R$ {resultadoExibido.economia_projetada.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div>
                    <span>Valor do sistema à vista</span>
                    <strong>R$ {resultadoExibido.investimento_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                    <small>Antes dos encargos de financiamento</small>
                  </div>
                </div>
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
                      Com base em uma conta de R$ {valorConta.toLocaleString("pt-BR")}, estimamos um consumo de {resultadoExibido.consumo_estimado.toLocaleString("pt-BR")} kWh por mês e uma potência de {resultadoExibido.potencia_kwp.toFixed(2)} kWp para o sistema solar.
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
                {salvandoSimulacao ? "Registrando simulação…" : simulacaoSalvaAtual ? "Registrar nova simulação" : "Registrar simulação"}
              </button>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel lead-panel" id="lead-form">
            <h2>Solicite uma proposta</h2>
            <p className="lead-prompt">Preencha seus dados e receba uma análise personalizada da sua economia.</p>
            <form onSubmit={handleLeadSubmit}>
              <input
                type="text"
                placeholder="Nome"
                value={leadForm.nome}
                onChange={(event) => setLeadForm({ ...leadForm, nome: event.target.value })}
              />
              <input
                type="text"
                placeholder="WhatsApp"
                value={leadForm.telefone}
                onChange={(event) => setLeadForm({ ...leadForm, telefone: event.target.value })}
              />
              <input
                type="email"
                placeholder="E-mail"
                value={leadForm.email}
                onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })}
              />
              <input
                type="text"
                placeholder="Cidade"
                value={leadForm.cidade}
                onChange={(event) => setLeadForm({ ...leadForm, cidade: event.target.value })}
              />
              <button type="submit" className="proposal-submit">Quero uma proposta</button>
            </form>
            <p className="status-message">{notificacao}</p>
          </div>
        </section>
      </section>
    </main>
  );
}
