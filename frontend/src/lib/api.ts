const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export type Lead = {
  id: number;
  nome: string;
  telefone: string;
  email?: string;
  cidade?: string;
  status: string;
  created_at: string;
};

export type SimulationResult = {
  economia_mensal: number;
  economia_anual: number;
  economia_projetada: number;
  potencia_kwp: number;
  investimento_estimado: number;
  consumo_estimado: number;
  prazo_pagamento: number;
  financiamento_id: number | null;
  financiamento_instituicao: string;
  taxa_juros_mensal: number;
  valor_pagamento_estimado: number;
  valor_total_pagamento_estimado: number;
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

export type FinancingOption = {
  id: number;
  instituicao: string;
  taxa_juros_mensal: number;
  ativa: boolean;
  updated_at?: string;
};

export type SimulationRecord = {
  id: number;
  valor_conta: number;
  economia_mensal: number;
  economia_anual: number;
  potencia_kwp: number;
  prazo_pagamento: number;
  financiamento_instituicao: string;
  taxa_juros_mensal: number;
  valor_pagamento_estimado: number;
  valor_total_pagamento_estimado: number;
  created_at: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error("Não foi possível comunicar com o servidor.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function adminHeaders(username: string, password: string) {
  return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
}

export const api = {
  createLead: (lead: Omit<Lead, "id" | "status" | "created_at">) =>
    request<{ lead: Lead }>("/api/leads", { method: "POST", body: JSON.stringify(lead) }),
  previewSimulation: (valor_conta: number, prazo_pagamento: number, financiamento_id: number | null) =>
    request<{ result: SimulationResult }>("/api/simulacoes/preview", { method: "POST", body: JSON.stringify({ valor_conta, prazo_pagamento, financiamento_id }) }),
  createSimulation: (valor_conta: number, prazo_pagamento: number, financiamento_id: number | null) =>
    request<{ simulation: SimulationRecord; result: SimulationResult }>("/api/simulacoes", { method: "POST", body: JSON.stringify({ valor_conta, prazo_pagamento, financiamento_id }) }),
  getPublicDashboard: () => request<Dashboard>("/api/public/dashboard"),
  getPublicFinancingOptions: () => request<Omit<FinancingOption, "ativa" | "updated_at">[]>("/api/public/financiamentos"),
  getDashboard: (username: string, password: string) =>
    request<Dashboard>("/api/dashboard", { headers: adminHeaders(username, password) }),
  getLeads: (username: string, password: string) => request<Lead[]>("/api/leads", { headers: adminHeaders(username, password) }),
  getSimulations: (username: string, password: string) => request<SimulationRecord[]>("/api/simulacoes", { headers: adminHeaders(username, password) }),
  updateLeadStatus: (id: number, status: string, username: string, password: string) =>
    request<{ lead: Lead }>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }), headers: adminHeaders(username, password) }),
  getSettings: (username: string, password: string) =>
    request<SimulatorSetting[]>("/api/configuracoes", { headers: adminHeaders(username, password) }),
  getFinancingOptions: (username: string, password: string) =>
    request<FinancingOption[]>("/api/financiamentos", { headers: adminHeaders(username, password) }),
  createFinancingOption: (option: Pick<FinancingOption, "instituicao" | "taxa_juros_mensal">, username: string, password: string) =>
    request<{ option: FinancingOption }>("/api/financiamentos", { method: "POST", body: JSON.stringify(option), headers: adminHeaders(username, password) }),
  updateFinancingOption: (option: FinancingOption, username: string, password: string) =>
    request<{ option: FinancingOption }>(`/api/financiamentos/${option.id}`, { method: "PATCH", body: JSON.stringify(option), headers: adminHeaders(username, password) }),
  deleteFinancingOption: (id: number, username: string, password: string) =>
    request<void>(`/api/financiamentos/${id}`, { method: "DELETE", headers: adminHeaders(username, password) }),
  updateSetting: (id: number, valor: number, username: string, password: string) =>
    request<{ config: SimulatorSetting }>(`/api/configuracoes/${id}`, { method: "PATCH", body: JSON.stringify({ valor }), headers: adminHeaders(username, password) }),
};