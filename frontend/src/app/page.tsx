"use client";

import { useEffect, useState } from "react";
import { api, type Dashboard, type FinancingOption, type SimulationResult } from "@/lib/api";

export default function Home() {
  const [valorConta, setValorConta] = useState(520);
  const [leadForm, setLeadForm] = useState({ nome: "", telefone: "", email: "", cidade: "" });
  const [resultadoExibido, setResultadoExibido] = useState<SimulationResult | null>({
    economia_mensal: 182,
    economia_anual: 2184,
    economia_projetada: 54600,
    potencia_kwp: 2.91,
    investimento_estimado: 12222,
    consumo_estimado: 306,
    prazo_pagamento: 0,
    financiamento_id: null,
    financiamento_instituicao: "",
    taxa_juros_mensal: 0,
    valor_pagamento_estimado: 12222,
    valor_total_pagamento_estimado: 12222,
  });
  const [prazoPagamento, setPrazoPagamento] = useState(0);
  const [opcoesFinanciamento, setOpcoesFinanciamento] = useState<Omit<FinancingOption, "ativa" | "updated_at">[]>([]);
  const [financiamentoId, setFinanciamentoId] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [notificacao, setNotificacao] = useState("Simulação pronta para análise comercial.");

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

  const handleSimular = async () => {
    if (prazoPagamento > 0 && financiamentoId === null) {
      setNotificacao("Selecione uma instituição financiadora para calcular as parcelas.");
      return;
    }

    try {
      const { result } = await api.createSimulation(valorConta, prazoPagamento, financiamentoId);
      setResultadoExibido(result);
      api.getPublicDashboard().then(setDashboard).catch(() => setDashboard(null));
      setNotificacao("Simulação concluída com sucesso. O cliente pode solicitar proposta.");
    } catch {
      setNotificacao("Não foi possível realizar a simulação. Tente novamente.");
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
            <p className="eyebrow">JB ECOSOLAR</p>
            <h1>Pague até 95% menos na sua conta de energia</h1>
            <p className="subtitle">
              Descubra quanto você pode economizar com um projeto fotovoltaico pensado para sua residência, empresa ou propriedade rural.
            </p>
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
              <h2 id="payment-heading">Opções de pagamento</h2>
              <p>Escolha uma opção para incluir na simulação.</p>
              <fieldset className="payment-options">
                <legend className="visually-hidden">Selecione uma opção de pagamento</legend>
                {[0, 12, 24, 36].map((term) => {
                  const label = term === 0 ? "À vista" : `${term} parcelas`;
                  return (
                    <label className="payment-option" key={term}>
                      <input
                        type="radio"
                        name="prazo-pagamento"
                        value={term}
                        checked={prazoPagamento === term}
                        disabled={term > 0 && opcoesFinanciamento.length === 0}
                        onChange={() => setPrazoPagamento(term)}
                      />
                      <span>
                        <strong>{label}</strong>
                        <small>{term === 0 ? "Pagamento único" : opcoesFinanciamento.length > 0 ? "Taxa informada pela instituição" : "Indisponível sem taxa"}</small>
                      </span>
                    </label>
                  );
                })}
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
                </div>
              )}
            </section>
            <div className="simulator-actions">
              <button type="button" onClick={handleSimular} className="simulator-action">Simular minha economia</button>
            </div>
            {resultadoExibido && (
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
                    <span>Investimento estimado</span>
                    <strong>R$ {resultadoExibido.investimento_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
                <details className="payment-estimate">
                  <summary>Detalhes da simulação e pagamento</summary>
                  {resultadoExibido.prazo_pagamento === prazoPagamento && (prazoPagamento === 0 || resultadoExibido.financiamento_id === financiamentoId) ? (
                    <p className="payment-selected">
                      {prazoPagamento === 0
                        ? `Valor estimado à vista: R$ ${resultadoExibido.valor_pagamento_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : `Parcela estimada em ${prazoPagamento}x com ${resultadoExibido.financiamento_instituicao}: R$ ${resultadoExibido.valor_pagamento_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    </p>
                  ) : (
                    <p className="payment-selected" role="status">
                      Opção alterada. Clique em Simular minha economia para recalcular o pagamento.
                    </p>
                  )}
                  {prazoPagamento > 0 && resultadoExibido.prazo_pagamento === prazoPagamento && resultadoExibido.financiamento_id === financiamentoId && (
                    <p className="payment-total">
                      Taxa usada: {resultadoExibido.taxa_juros_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% a.m. · Total estimado: R$ {resultadoExibido.valor_total_pagamento_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <p className="payment-disclaimer">
                    A taxa é informada manualmente pelo administrador com base nos dados fornecidos pela instituição; não há integração bancária. Esta estimativa aplica juros compostos mensais e não necessariamente representa o CET: pode excluir IOF, tarifas, entrada e outras condições. Confirme a proposta, a taxa vigente e a aprovação diretamente com a instituição antes de contratar.
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
            )}
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
