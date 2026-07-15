# AI Architecture — FinGuide Agent System

## Overview

FinGuide uses a **multi-agent AI architecture** with **RAG (Retrieval-Augmented Generation)** to provide intelligent financial guidance. The system analyzes Israeli payslips via OCR and answers user questions through specialized AI agents.

```
┌─────────────────────────────────────────────────────────┐
│                    User Question                         │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Orchestrator Agent                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Intent Classification (rule-based + LLM)       │    │
│  └────────────────────────┬────────────────────────┘    │
└───────────────────────────┼─────────────────────────────┘
                            ▼
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Payslip     │  │  Pension     │  │  Financial   │
│  Agent       │  │  Agent       │  │  Analysis    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Financial   │  │  Insurance   │  │  General     │
│  Planning    │  │  Agent       │  │  (fallback)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                RAG Retrieval Layer                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │
│  │ Knowledge  │  │ User Docs  │  │ Vector Store   │    │
│  │ Base       │  │ (payslips) │  │ (cosine sim)   │    │
│  └────────────┘  └────────────┘  └────────────────┘    │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│              LLM (Claude / Ollama)                       │
│  System prompt + RAG context + user data + query        │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Response to User                            │
│  { answer, agent, classification, sources, model }      │
└─────────────────────────────────────────────────────────┘
```

---

## Agents

| Agent                  | File                                        | Specialization                              |
| ---------------------- | ------------------------------------------- | ------------------------------------------- |
| **Orchestrator**       | `services/agents/orchestrator.js`           | Routes queries, classifies intent           |
| **Payslip Analysis**   | `services/agents/payslipAgent.js`           | Explains salary slip fields, detects issues |
| **Pension Advisor**    | `services/agents/pensionAgent.js`           | Pension contributions, legal minimums       |
| **Gemel Advisor**      | `services/agents/gemelAgent.js`             | Provident/study funds, Gemel-Net comparison |
| **Financial Analysis** | `services/agents/financialAnalysisAgent.js` | Trends, anomalies, benchmarks               |
| **Financial Planning** | `services/agents/financialPlanningAgent.js` | Savings, budget, retirement                 |
| **Insurance Benefits** | `services/agents/insuranceAgent.js`         | Insurance recommendations                   |

---

## RAG Pipeline

### Components

| Component             | File                                      | Purpose                                   |
| --------------------- | ----------------------------------------- | ----------------------------------------- |
| **Embedding Service** | `services/embeddings/embeddingService.js` | Generates vectors via Ollama `all-minilm` |
| **Vector Store**      | `services/embeddings/vectorStore.js`      | Local JSON-based vector DB                |
| **Document Chunker**  | `services/embeddings/documentChunker.js`  | Splits text into embeddable chunks        |
| **Knowledge Base**    | `services/embeddings/knowledgeBase.js`    | Curated Israeli financial knowledge       |
| **RAG Service**       | `services/embeddings/ragService.js`       | Orchestrates retrieval pipeline           |

### Flow

```
1. Knowledge base articles → chunked → embedded → stored in vector_store.json
2. User payslips → chunked by section → embedded → stored with userId metadata
3. At query time:
   - Embed the user's question
   - Search vector store (cosine similarity)
   - Filter: 60% knowledge base + 40% user documents
   - Inject top-K results into LLM system prompt
   - LLM generates grounded answer
```

### Why Local Vector Store?

- **Zero infrastructure** — works offline, no API keys needed
- **Demo-friendly** — vector_store.json can be inspected visually
- **Sufficient** — <1000 chunks for a student project
- **Upgrade path** — swap to MongoDB Atlas Vector Search in production

---

## API Endpoints

| Method | Path                    | Description                           |
| ------ | ----------------------- | ------------------------------------- |
| `POST` | `/api/agents/ask`       | Ask the multi-agent system a question |
| `GET`  | `/api/agents/list`      | List available agents                 |
| `POST` | `/api/agents/embed`     | Embed a specific document             |
| `GET`  | `/api/agents/rag/stats` | Get RAG statistics                    |
| `POST` | `/api/agents/rag/index` | Index/re-index knowledge base         |

### Example: Ask Agent

```bash
curl -X POST http://localhost:5000/api/agents/ask \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "האם הפנסיה שלי תקינה?"}'
```

Response:

```json
{
  "success": true,
  "data": {
    "answer": "לפי תלוש השכר שלך, הפרשת העובד לפנסיה היא 6% ...",
    "agent": "pension_advisor",
    "classification": "pension_advisor",
    "sources": [
      { "title": "חובת פנסיה בישראל", "category": "pension", "score": 0.82 }
    ],
    "model": "claude-sonnet-4-20250514",
    "tokensUsed": 450
  }
}
```

---

## Frontend

The AI Agents page is available at `/ai-agents` and provides:

- Visual agent cards showing all 5 specialist agents
- Quick prompt buttons for common questions
- Chat interface with agent badges (shows which agent handled each response)
- RAG source attribution (expandable details showing which knowledge chunks were used)
- Educational disclaimer

---

## How to Initialize

1. Start the app: `npm run dev`
2. Log in and upload a payslip
3. Navigate to `/ai-agents`
4. First time: call `POST /api/agents/rag/index` to embed the knowledge base
5. Start asking questions — the orchestrator routes automatically

---

## Environment Variables

Add to `backend/.env`:

```bash
# AI Agent System
ANTHROPIC_API_KEY=sk-ant-...        # Required for Claude-based agents
CHAT_PROVIDER=claude                 # claude | ollama
CHAT_MODEL=claude-sonnet-4-20250514  # Model for agents
EMBEDDING_MODEL=all-minilm           # Ollama embedding model
OLLAMA_URL=http://10.10.248.41       # Ollama server URL
```

---

## Demo Flow for Presentation

1. **Show the architecture diagram** (above)
2. **Upload a payslip** → OCR extracts data → stored in DB
3. **Ask "תסביר לי את התלוש"** → routed to Payslip Agent → explains all fields
4. **Ask "האם הפנסיה שלי תקינה?"** → routed to Pension Agent → compares to legal minimums
5. **Ask "איך אני יכול לחסוך יותר?"** → routed to Planning Agent → gives budget advice
6. **Show the RAG sources** — expand the sources section to show knowledge base retrieval
7. **Show the agent badge** — each response shows which agent handled it
8. **Emphasize**: no hallucination (data from DB), no raw DB access (context injection only)

---

## Security: How AI Accesses Data Safely

```
User message → Backend (authenticated via JWT)
                    ↓
          buildAgentUserContext(userId)  ← queries MongoDB for THIS user only
                    ↓
          Structured numbers/strings only (no raw text)
                    ↓
          Injected into system prompt as text
                    ↓
          Claude/Ollama — has NO database connection, NO credentials
                    ↓
          Returns text answer only
```

The AI never:

- Directly accesses the database
- Sees raw OCR text
- Gets another user's data
- Receives client-supplied context (always rebuilt from DB)
