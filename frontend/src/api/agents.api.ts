import { apiJson } from "./client";

export type AgentSource = {
  id: string;
  score: number;
  category?: string;
  source?: string;
  title?: string;
};

export type AgentInfo = {
  id: string;
  name: string;
  description: string;
};

export type AskAgentResponse = {
  success: boolean;
  data: {
    answer: string;
    agent: string;
    classification: string;
    sources: AgentSource[];
    model: string | null;
    tokensUsed: number | null;
  };
};

export type ListAgentsResponse = {
  success: boolean;
  data: {
    agents: AgentInfo[];
  };
};

export type RAGStatsResponse = {
  success: boolean;
  data: {
    totalChunks: number;
    categories: Record<string, number>;
    knowledgeBaseIndexed: boolean;
  };
};

export async function askAgent(message: string, conversationHistory: Array<{ role: string; content: string }> = []) {
  const result = await apiJson<AskAgentResponse>("/api/agents/ask", {
    method: "POST",
    body: { message, conversationHistory },
    auth: true,
  });
  return result;
}

export async function listAgents() {
  const result = await apiJson<ListAgentsResponse>("/api/agents/list", {
    auth: true,
  });
  return result;
}

export async function embedDocument(documentId: string) {
  const result = await apiJson<{ success: boolean; data: { indexed: number } }>("/api/agents/embed", {
    method: "POST",
    body: { documentId },
    auth: true,
  });
  return result;
}

export async function getRAGStats() {
  const result = await apiJson<RAGStatsResponse>("/api/agents/rag/stats", {
    auth: true,
  });
  return result;
}

export async function indexKnowledgeBase() {
  const result = await apiJson<{ success: boolean; data: { indexed: number; failed: number } }>("/api/agents/rag/index", {
    method: "POST",
    auth: true,
  });
  return result;
}
