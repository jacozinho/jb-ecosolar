"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type Dashboard, type FinancingOption, type Lead, type SimulatorSetting } from "@/lib/api";

export default function AdminPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<SimulatorSetting[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [financingOptions, setFinancingOptions] = useState<FinancingOption[]>([]);
  const [newFinancingInstitution, setNewFinancingInstitution] = useState("");
  const [newFinancingRate, setNewFinancingRate] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;

    Promise.all([
      api.getLeads(username, password),
      api.getSettings(username, password),
      api.getDashboard(username, password),
      api.getFinancingOptions(username, password),
    ])
      .then(([loadedLeads, loadedSettings, loadedDashboard, loadedFinancingOptions]) => {
        setLeads(loadedLeads);
        setSettings(loadedSettings);
        setDashboard(loadedDashboard);
        setFinancingOptions(loadedFinancingOptions);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setError("Usuário ou senha inválidos.");
      });
  }, [isAuthenticated, password, username]);

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();

    setIsAuthenticated(true);
    setError("");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    setError("");
    setDashboard(null);
  };

  const atualizarStatus = async (lead: Lead) => {
    const nextStatus = lead.status === "NOVO" ? "CONTATADO" : lead.status === "CONTATADO" ? "QUALIFICADO" : lead.status === "QUALIFICADO" ? "PROPOSTA ENVIADA" : "CONTRATADO";

    try {
      const { lead: updatedLead } = await api.updateLeadStatus(lead.id, nextStatus, username, password);
      setLeads((previous) => previous.map((item) => (item.id === updatedLead.id ? updatedLead : item)));
    } catch {
      setError("Não foi possível atualizar o status do lead.");
    }
  };

  const updateSettingValue = (id: number, value: string) => {
    setSettings((previous) => previous.map((setting) => (setting.id === id ? { ...setting, valor: Number(value) } : setting)));
  };

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const savedSettings = await Promise.all(settings.map((setting) => api.updateSetting(setting.id, setting.valor, username, password)));
      setSettings(savedSettings.map(({ config }) => config));
      setError("");
    } catch {
      setError("Não foi possível salvar as configurações.");
    }
  };

  const addFinancingOption = async (event: React.FormEvent) => {
    event.preventDefault();
    const rate = Number(newFinancingRate);
    if (!newFinancingInstitution.trim() || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      setError("Informe a instituição e uma taxa mensal entre 0 e 100%.");
      return;
    }

    try {
      const { option } = await api.createFinancingOption({ instituicao: newFinancingInstitution.trim(), taxa_juros_mensal: rate }, username, password);
      setFinancingOptions((previous) => [...previous, option]);
      setNewFinancingInstitution("");
      setNewFinancingRate("");
      setError("");
    } catch {
      setError("Não foi possível cadastrar a opção de financiamento.");
    }
  };

  const updateFinancingOptionValue = (id: number, field: "instituicao" | "taxa_juros_mensal" | "ativa", value: string | number | boolean) => {
    setFinancingOptions((previous) => previous.map((option) => (option.id === id ? { ...option, [field]: value } : option)));
  };

  const saveFinancingOption = async (option: FinancingOption) => {
    try {
      const { option: savedOption } = await api.updateFinancingOption(option, username, password);
      setFinancingOptions((previous) => previous.map((item) => (item.id === savedOption.id ? savedOption : item)));
      setError("");
    } catch {
      setError("Não foi possível atualizar a opção de financiamento.");
    }
  };

  const removeFinancingOption = async (id: number) => {
    try {
      await api.deleteFinancingOption(id, username, password);
      setFinancingOptions((previous) => previous.filter((option) => option.id !== id));
      setError("");
    } catch {
      setError("Não foi possível excluir a opção de financiamento.");
    }
  };

  const stats = useMemo(
    () => ({
      leads: leads.length,
      convertidos: leads.filter((lead) => lead.status !== "NOVO").length,
      conversao: Math.round((leads.filter((lead) => lead.status !== "NOVO").length / Math.max(leads.length, 1)) * 100),
      emNegociacao: leads.filter((lead) => lead.status === "NEGOCIAÇÃO" || lead.status === "PROPOSTA ENVIADA").length,
      porStatus: {
        novos: leads.filter((lead) => lead.status === "NOVO").length,
        contatados: leads.filter((lead) => lead.status === "CONTATADO").length,
        qualificados: leads.filter((lead) => lead.status === "QUALIFICADO").length,
        propostas: leads.filter((lead) => lead.status === "PROPOSTA ENVIADA").length,
        contratados: leads.filter((lead) => lead.status === "CONTRATADO").length,
      },
    }),
    [leads],
  );

  return (
    <main className="page-shell admin-page-shell">
      <header className="brand-bar admin-brand-bar">
        <img src="/logo-jbecosolar.png" alt="JB Ecosolar" className="brand-logo" />
      </header>

      <nav className="top-nav" aria-label="Navegação administrativa">
        <Link href="/">Voltar para o cliente</Link>
      </nav>

      {!isAuthenticated ? (
        <section className="login-panel panel">
          <div className="admin-header">
            <span>Área interna</span>
            <h2>Login do painel administrativo</h2>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="admin-user">Usuário</label>
            <input
              id="admin-user"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Digite o usuário"
            />

            <label htmlFor="admin-password">Senha</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite a senha"
            />
            {error ? <p className="login-error">{error}</p> : null}
            <button type="submit">Entrar no painel</button>
          </form>
        </section>
      ) : (
        <section className="admin-module admin-page">
          <div className="admin-header">
            <span>Área interna</span>
            <h2>Painel administrativo</h2>
            <button type="button" className="logout-button" onClick={handleLogout}>Sair</button>
          </div>

          <div className="metric-bar admin-metrics">
            <div>
              <span>Simulações</span>
              <strong>{dashboard?.totalSimulacoes.toLocaleString("pt-BR") ?? "—"}</strong>
            </div>
            <div>
              <span>Leads</span>
              <strong>{stats.leads}</strong>
            </div>
            <div>
              <span>Conversão</span>
              <strong>{stats.conversao}%</strong>
              <details className="conversion-breakdown">
                <summary>{stats.convertidos} convertidos de {stats.leads} leads</summary>
                <ul>
                  <li>Novos: {stats.porStatus.novos}</li>
                  <li>Contatados: {stats.porStatus.contatados}</li>
                  <li>Qualificados: {stats.porStatus.qualificados}</li>
                  <li>Propostas enviadas: {stats.porStatus.propostas}</li>
                  <li>Contratados: {stats.porStatus.contratados}</li>
                </ul>
              </details>
            </div>
            <div>
              <span>Em proposta</span>
              <strong>{stats.emNegociacao}</strong>
            </div>
          </div>

          <div className="panel admin-panel">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>WhatsApp</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.nome}</td>
                    <td>{lead.telefone}</td>
                    <td>{lead.status}</td>
                    <td>
                      <button type="button" className="mini-button" onClick={() => atualizarStatus(lead)}>
                        Avançar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="panel simulator-settings">
            <div className="admin-header">
              <span>Simulador</span>
              <h2>Configurações de cálculo</h2>
            </div>
            <form onSubmit={saveSettings} className="settings-form">
              {settings.map((setting) => (
                <label key={setting.id} htmlFor={`setting-${setting.id}`}>
                  <span>{setting.descricao}</span>
                  <input
                    id={`setting-${setting.id}`}
                    type="number"
                    step="any"
                    value={setting.valor}
                    onChange={(event) => updateSettingValue(setting.id, event.target.value)}
                  />
                </label>
              ))}
              <button type="submit">Salvar configurações</button>
            </form>
            {error ? <p className="login-error">{error}</p> : null}
          </section>

          <section className="panel financing-settings">
            <div className="admin-header">
              <span>Parcelamento</span>
              <h2>Taxas de financiamento</h2>
            </div>
            <p className="financing-admin-note">
              Cadastre manualmente a taxa efetiva mensal informada pelo banco ou financiadora. Não há integração com instituições financeiras; confirme taxa, CET, IOF, tarifas e condições antes de publicar a opção.
            </p>
            <form onSubmit={addFinancingOption} className="financing-create-form">
              <label>
                Instituição financeira
                <input value={newFinancingInstitution} onChange={(event) => setNewFinancingInstitution(event.target.value)} maxLength={120} required />
              </label>
              <label>
                Taxa efetiva mensal (% a.m.)
                <input type="number" min="0" max="100" step="0.0001" value={newFinancingRate} onChange={(event) => setNewFinancingRate(event.target.value)} required />
              </label>
              <button type="submit">Adicionar opção</button>
            </form>
            {financingOptions.length > 0 ? (
              <div className="financing-options-list">
                {financingOptions.map((option) => (
                  <div className="financing-option-row" key={option.id}>
                    <label>
                      Instituição
                      <input value={option.instituicao} onChange={(event) => updateFinancingOptionValue(option.id, "instituicao", event.target.value)} maxLength={120} />
                    </label>
                    <label>
                      Taxa mensal (% a.m.)
                      <input type="number" min="0" max="100" step="0.0001" value={option.taxa_juros_mensal} onChange={(event) => updateFinancingOptionValue(option.id, "taxa_juros_mensal", Number(event.target.value))} />
                    </label>
                    <label className="financing-active-toggle">
                      <input type="checkbox" checked={option.ativa} onChange={(event) => updateFinancingOptionValue(option.id, "ativa", event.target.checked)} />
                      Disponível ao cliente
                    </label>
                    <button type="button" className="mini-button" onClick={() => saveFinancingOption(option)}>Salvar</button>
                    <button type="button" className="mini-button financing-delete" onClick={() => removeFinancingOption(option.id)}>Excluir</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="financing-admin-note">Nenhuma opção cadastrada. O cliente verá apenas pagamento à vista até que uma taxa seja informada.</p>
            )}
            {error ? <p className="login-error">{error}</p> : null}
          </section>
        </section>
      )}
    </main>
  );
}
