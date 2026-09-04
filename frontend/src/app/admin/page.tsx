"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type Lead, type SimulatorSetting } from "@/lib/api";

export default function AdminPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<SimulatorSetting[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;

    Promise.all([api.getLeads(username, password), api.getSettings(username, password)])
      .then(([loadedLeads, loadedSettings]) => {
        setLeads(loadedLeads);
        setSettings(loadedSettings);
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

  const stats = useMemo(
    () => ({
      leads: leads.length,
      conversao: Math.round((leads.filter((lead) => lead.status !== "NOVO").length / Math.max(leads.length, 1)) * 100),
      emNegociacao: leads.filter((lead) => lead.status === "NEGOCIAÇÃO" || lead.status === "PROPOSTA ENVIADA").length,
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
              <span>Leads</span>
              <strong>{stats.leads}</strong>
            </div>
            <div>
              <span>Conversão</span>
              <strong>{stats.conversao}%</strong>
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
        </section>
      )}
    </main>
  );
}
