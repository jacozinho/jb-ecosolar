const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export type Lead = {
  id: number;
  nome: string;
  telefone: string;
  email?: string;
  cidade?: string;
  status: string;
};

export type SimulationResult = {
  economia_mensal: number;
  economia_anual: number;
  economia_projetada: number;
  potencia_kwp: number;
  investimento_estimado: number;
  consumo_estimado: number;
  prazo_pagamento: number;
  valor_pagamento_estimado: number;
};

export type Dashboard = {
  totalSimulacoes: number;
  totalLeads: number;
  conversao: number;
};

export type SimulatorSetting = {
  id: number;
  parametro: string;
  valor: number;
  descricao: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (!response.ok) {
    throw new Error("Não foi possível comunicar com o servidor.");
  }

  return response.json() as Promise<T>;
}

function adminHeaders(username: string, password: string) {
  return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
}

export const api = {
  createLead: (lead: Omit<Lead, "id" | "status">) =>
    request<{ lead: Lead }>("/api/leads", { method: "POST", body: JSON.stringify(lead) }),
  createSimulation: (valor_conta: number, prazo_pagamento: number) =>
    request<{ result: SimulationResult }>("/api/simulacoes", { method: "POST", body: JSON.stringify({ valor_conta, prazo_pagamento }) }),
  getPublicDashboard: () => request<Dashboard>("/api/public/dashboard"),
  getDashboard: () => request<Dashboard>("/api/dashboard"),
  getLeads: (username: string, password: string) => request<Lead[]>("/api/leads", { headers: adminHeaders(username, password) }),
  updateLeadStatus: (id: number, status: string, username: string, password: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }), headers: adminHeaders(username, password) }),
  getSettings: (username: string, password: string) =>
    request<SimulatorSetting[]>("/api/configuracoes", { headers: adminHeaders(username, password) }),
  updateSetting: (id: number, valor: number, username: string, password: string) =>
    request<{ config: SimulatorSetting }>(`/api/configuracoes/${id}`, { method: "PATCH", body: JSON.stringify({ valor }), headers: adminHeaders(username, password) }),
};