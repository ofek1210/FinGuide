import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  streamChatWithAI,
  getChatHistory,
  listConversations,
  deleteConversation as deleteConversationApi,
  renameConversation as renameConversationApi,
  submitMessageFeedback,
  type ChatCitation,
  type ConversationSummary,
} from "../api/ai.api";
import { useAuth } from "../auth/AuthProvider";
import { describePageContext, describePageGuide } from "./pageContext";
import { APP_ROUTES } from "../types/navigation";

const AI_CHAT_STORAGE_KEY = "finguide_ai_chat";
const AI_CONVERSATION_ID_KEY = "finguide_conversation_id";
const AI_PANEL_OPEN_KEY = "finguide_ai_chat_open";

export type PageContextOverride = {
  label: string;
  detail?: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
  degradedReason?: string;
  contextUsed?: string[];
  citations?: ChatCitation[];
  latencyMs?: number | null;
  feedbackRating?: 1 | -1 | null;
  isStreaming?: boolean;
};

export const AI_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "שלום! אני העוזר הפיננסי של FinGuide.\n\nאני יכול לענות על שאלות כמו:\n- **כמה שכר נטו קיבלת** החודש\n- **ניתוח הפרשות פנסיה** ביחס לחובה החוקית\n- **סימולציה**: מה יקרה אם תקבל העלאה של 10%?\n- **זיהוי חריגות** וממצאים במערכת\n- **שאלות כלליות** על מס, ביטוח לאומי, קרן השתלמות\n\nשאל/י אותי כל שאלה פיננסית!",
};

export const AI_PROMPT_SUGGESTIONS = [
  "כמה שכר נטו קיבלתי החודש?",
  "כמה פנסיה מנכים לי מהשכר?",
  "מה השתנה בתלוש האחרון שלי?",
  "יש חריגות בתלושים שלי?",
  "מה יקרה אם אקבל העלאה של 10%?",
  "כמה מנכים לי מס הכנסה?",
  "מה יתרת ימי החופשה שלי?",
  "תן לי סיכום פיננסי של המצב שלי.",
  "אילו ביטוחים אני צריך?",
  "כמה קרן השתלמות חסכתי?",
] as const;

/** Page-aware suggestion chips for the floating assistant. */
export function getSuggestionsForPath(pathname: string): readonly string[] {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === APP_ROUTES.hub) {
    return [
      "תן לי סיכום פיננסי של המצב שלי.",
      "מה הכי חשוב לעשות עכשיו?",
      "יש חריגות בתלושים שלי?",
      "כמה שכר נטו קיבלתי החודש?",
    ];
  }
  if (path === APP_ROUTES.pension || path.startsWith(`${APP_ROUTES.pension}/`)) {
    return [
      "מה מצב הפנסיה שלי?",
      "כמה פנסיה מנכים לי מהשכר?",
      "מה כדאי לשפר בפנסיה?",
      "תן לי סיכום פיננסי של המצב שלי.",
    ];
  }
  if (path === APP_ROUTES.insurance || path.startsWith(`${APP_ROUTES.insurance}/`)) {
    return [
      "מה מצב הביטוחים שלי?",
      "אילו ביטוחים אני צריך?",
      "מה הכי חשוב לעשות עכשיו?",
      "תן לי סיכום פיננסי של המצב שלי.",
    ];
  }
  if (path === APP_ROUTES.gemel || path.startsWith(`${APP_ROUTES.gemel}/`)) {
    return [
      "יש לי קרן השתלמות?",
      "כמה קרן השתלמות חסכתי?",
      "תן לי סיכום פיננסי של המצב שלי.",
      "מה הכי חשוב לעשות עכשיו?",
    ];
  }
  if (
    path === APP_ROUTES.payslipHistory ||
    path.startsWith("/documents/history/") ||
    path === APP_ROUTES.documents
  ) {
    return [
      "כמה שכר נטו קיבלתי החודש?",
      "מה השתנה בתלוש האחרון שלי?",
      "יש חריגות בתלושים שלי?",
      "כמה פנסיה מנכים לי מהשכר?",
    ];
  }
  if (path === APP_ROUTES.financialHealth) {
    return [
      "תן לי סיכום פיננסי של המצב שלי.",
      "מה הכי חשוב לעשות עכשיו?",
      "מה מצב הפנסיה שלי?",
      "מה מצב הביטוחים שלי?",
    ];
  }

  return AI_PROMPT_SUGGESTIONS.slice(0, 4);
}

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window.SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition)
    : undefined;

export const isVoiceInputSupported = Boolean(SpeechRecognitionAPI);

type AiChatContextValue = {
  messages: ChatMessage[];
  conversationId: string | null;
  conversations: ConversationSummary[];
  isSending: boolean;
  isListening: boolean;
  error: string;
  isPanelOpen: boolean;
  pageContext: string | null;
  lastFailedUserMessage: string | null;
  historyHydrated: boolean;
  rateLimitedUntil: number | null;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  sendMessage: (text: string) => void;
  stopGeneration: () => void;
  retryLastFailed: () => void;
  clearChat: () => void;
  selectConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  rateMessage: (messageId: string, rating: 1 | -1) => Promise<void>;
  startVoiceInput: (onTranscript: (text: string) => void) => void;
  stopVoiceInput: () => void;
  setPageContextOverride: (value: PageContextOverride | null) => void;
  suggestions: readonly string[];
};

const AiChatContext = createContext<AiChatContextValue | null>(null);

function saveMessages(messages: ChatMessage[]) {
  try {
    const toStore = messages
      .filter((m) => !m.isStreaming)
      .map(
        ({
          id,
          role,
          content,
          source,
          contextUsed,
          citations,
          degradedReason,
          latencyMs,
          feedbackRating,
        }) => ({
          id,
          role,
          content,
          source,
          contextUsed,
          citations,
          degradedReason,
          latencyMs,
          feedbackRating,
        }),
      );
    sessionStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    /* ignore */
  }
}

function loadStoredMessages(): ChatMessage[] | null {
  try {
    const raw = sessionStorage.getItem(AI_CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const messages: ChatMessage[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as ChatMessage).id === "string" &&
        ((item as ChatMessage).role === "user" ||
          (item as ChatMessage).role === "assistant") &&
        typeof (item as ChatMessage).content === "string"
      ) {
        const m = item as ChatMessage;
        messages.push({
          id: m.id,
          role: m.role,
          content: m.content,
          source: m.source,
          contextUsed: m.contextUsed,
          citations: m.citations,
          degradedReason: m.degradedReason,
          latencyMs: m.latencyMs,
          feedbackRating: m.feedbackRating,
        });
      }
    }
    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
}

export function AiChatProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";
  const location = useLocation();

  const [pageContextOverride, setPageContextOverride] =
    useState<PageContextOverride | null>(null);
  const routeLabel = describePageContext(location.pathname);
  const routeGuide = describePageGuide(location.pathname);
  const pageContext = pageContextOverride?.label ?? routeLabel;
  const pageGuide = (() => {
    const detail = pageContextOverride?.detail?.trim();
    if (detail && routeGuide) {
      return `${routeGuide}\n\n--- מצב נוכחי במסך ---\n${detail}`;
    }
    if (detail) return detail;
    if (pageContextOverride?.label && routeGuide) {
      return `${routeGuide}\n\nהמשתמש צופה כעת ב: ${pageContextOverride.label}`;
    }
    return routeGuide ?? pageContext;
  })();
  const pageGuideRef = useRef<string | null>(pageGuide);
  useEffect(() => {
    pageGuideRef.current = pageGuide;
  }, [pageGuide]);

  const suggestions = useMemo(
    () => getSuggestionsForPath(location.pathname),
    [location.pathname],
  );

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = loadStoredMessages();
    return stored ?? [AI_WELCOME_MESSAGE];
  });
  const [conversationId, setConversationId] = useState<string | null>(() =>
    sessionStorage.getItem(AI_CONVERSATION_ID_KEY),
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(
    () => sessionStorage.getItem(AI_PANEL_OPEN_KEY) === "1",
  );
  const [lastFailedUserMessage, setLastFailedUserMessage] = useState<string | null>(
    null,
  );
  const [historyHydrated, setHistoryHydrated] = useState(!conversationId);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  const streamAbortRef = useRef<(() => void) | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const refreshConversations = useCallback(() => {
    if (!isAuthenticated) return;
    void listConversations().then((res) => {
      if (res.success && res.data) setConversations(res.data);
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !conversationId) {
      setHistoryHydrated(true);
      return;
    }
    let cancelled = false;
    setHistoryHydrated(false);
    void getChatHistory(conversationId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data?.length) {
        const loaded: ChatMessage[] = res.data
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m._id,
            role: m.role as "user" | "assistant",
            content: m.content,
            source: m.metadata?.source ?? undefined,
            contextUsed: m.metadata?.contextUsed,
            degradedReason: m.metadata?.degradedReason ?? undefined,
            latencyMs: m.metadata?.latencyMs ?? null,
            feedbackRating:
              m.metadata?.feedbackRating === 1 || m.metadata?.feedbackRating === -1
                ? m.metadata.feedbackRating
                : null,
          }));
        if (loaded.length) setMessages(loaded);
      }
      setHistoryHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshConversations();
  }, [isAuthenticated, refreshConversations]);

  useEffect(() => {
    if (conversationId) sessionStorage.setItem(AI_CONVERSATION_ID_KEY, conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!historyHydrated) return;
    saveMessages(messages);
  }, [messages, historyHydrated]);

  useEffect(() => {
    sessionStorage.setItem(AI_PANEL_OPEN_KEY, isPanelOpen ? "1" : "0");
  }, [isPanelOpen]);

  const stopVoiceInput = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => {
    stopVoiceInput();
    setIsPanelOpen(false);
  }, [stopVoiceInput]);
  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => {
      if (prev) stopVoiceInput();
      return !prev;
    });
  }, [stopVoiceInput]);

  const stopGeneration = useCallback(() => {
    streamAbortRef.current?.();
    streamAbortRef.current = null;
    setIsSending(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
        setError("חרגת ממגבלת השאלות לעוזר. נסו שוב בעוד כמה דקות.");
        return;
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      setMessages((prev) => {
        const next = [...prev, userMessage];
        saveMessages(next);
        return next;
      });
      setError("");
      setLastFailedUserMessage(null);
      setIsSending(true);

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", isStreaming: true },
      ]);

      // Server owns history — always send [].
      const abort = streamChatWithAI(
        trimmed,
        [],
        conversationId,
        (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m,
            ),
          );
        },
        (source, convId, meta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    id: meta?.messageId || m.id,
                    isStreaming: false,
                    source,
                    degradedReason: meta?.degradedReason,
                    contextUsed: meta?.contextUsed,
                    citations: meta?.citations,
                    latencyMs: meta?.latencyMs ?? null,
                  }
                : m,
            ),
          );
          setConversationId(convId);
          setIsSending(false);
          setRateLimitedUntil(null);
          refreshConversations();
        },
        (errMsg, info) => {
          if (errMsg) {
            setError(errMsg);
            setLastFailedUserMessage(trimmed);
            const sec =
              typeof info?.retryAfterSec === "number" && info.retryAfterSec > 0
                ? info.retryAfterSec
                : errMsg.includes("מגבלת השאלות")
                  ? 60
                  : null;
            if (sec) setRateLimitedUntil(Date.now() + sec * 1000);
          }
          setMessages((prev) => {
            const target = prev.find((m) => m.id === assistantId);
            if (target && target.content.trim().length > 0) {
              return prev.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m,
              );
            }
            return prev.filter((m) => m.id !== assistantId);
          });
          setIsSending(false);
        },
        pageGuideRef.current,
      );

      streamAbortRef.current = abort;
    },
    [conversationId, isSending, rateLimitedUntil, refreshConversations],
  );

  const retryLastFailed = useCallback(() => {
    if (!lastFailedUserMessage || isSending) return;
    const msg = lastFailedUserMessage;
    setLastFailedUserMessage(null);
    sendMessage(msg);
  }, [lastFailedUserMessage, isSending, sendMessage]);

  const clearChat = useCallback(() => {
    streamAbortRef.current?.();
    stopVoiceInput();
    setMessages([AI_WELCOME_MESSAGE]);
    setConversationId(null);
    sessionStorage.removeItem(AI_CONVERSATION_ID_KEY);
    sessionStorage.removeItem(AI_CHAT_STORAGE_KEY);
    setError("");
    setLastFailedUserMessage(null);
    setIsSending(false);
    setHistoryHydrated(true);
    refreshConversations();
  }, [refreshConversations, stopVoiceInput]);

  const selectConversation = useCallback(
    (id: string) => {
      stopGeneration();
      stopVoiceInput();
      setConversationId(id);
      refreshConversations();
    },
    [refreshConversations, stopGeneration, stopVoiceInput],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      stopGeneration();
      const res = await deleteConversationApi(id);
      if (!res.success) {
        setError(("message" in res && res.message) || "לא הצלחנו למחוק את השיחה.");
        return;
      }
      if (conversationId === id) {
        setMessages([AI_WELCOME_MESSAGE]);
        setConversationId(null);
        sessionStorage.removeItem(AI_CONVERSATION_ID_KEY);
        sessionStorage.removeItem(AI_CHAT_STORAGE_KEY);
      }
      refreshConversations();
    },
    [conversationId, refreshConversations, stopGeneration],
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const res = await renameConversationApi(id, title);
      if (!res.success) {
        setError(("message" in res && res.message) || "לא הצלחנו לשנות את שם השיחה.");
        return;
      }
      refreshConversations();
    },
    [refreshConversations],
  );

  const rateMessage = useCallback(async (messageId: string, rating: 1 | -1) => {
    if (!messageId || messageId.startsWith("assistant-") || messageId === "welcome") {
      return;
    }
    const res = await submitMessageFeedback(messageId, rating);
    if (!res.success) {
      setError(("message" in res && res.message) || "לא הצלחנו לשמור את הדירוג.");
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedbackRating: rating } : m)),
    );
  }, []);

  const startVoiceInput = useCallback(
    (onTranscript: (text: string) => void) => {
      if (!SpeechRecognitionAPI || isListening || isSending) return;
      stopVoiceInput();
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = "he-IL";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript ?? "";
        if (transcript) onTranscript(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        recognitionRef.current = null;
        if (event.error === "aborted") return;
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setError("גישה למיקרופון נדחתה. אפשרו גישה בדפדפן ונסו שוב.");
        } else if (event.error === "no-speech") {
          setError("לא זוהה דיבור. נסו שוב.");
        } else {
          setError("שגיאה בקלט הקולי. נסו שוב.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      try {
        recognition.start();
        setIsListening(true);
      } catch {
        setError("לא ניתן להפעיל את המיקרופון.");
        recognitionRef.current = null;
      }
    },
    [isListening, isSending, stopVoiceInput],
  );

  const value = useMemo<AiChatContextValue>(
    () => ({
      messages,
      conversationId,
      conversations,
      isSending,
      isListening,
      error,
      isPanelOpen,
      pageContext,
      lastFailedUserMessage,
      historyHydrated,
      rateLimitedUntil,
      openPanel,
      closePanel,
      togglePanel,
      sendMessage,
      stopGeneration,
      retryLastFailed,
      clearChat,
      selectConversation,
      deleteConversation,
      renameConversation,
      rateMessage,
      startVoiceInput,
      stopVoiceInput,
      setPageContextOverride,
      suggestions,
    }),
    [
      messages,
      conversationId,
      conversations,
      isSending,
      isListening,
      error,
      isPanelOpen,
      pageContext,
      lastFailedUserMessage,
      historyHydrated,
      rateLimitedUntil,
      openPanel,
      closePanel,
      togglePanel,
      sendMessage,
      stopGeneration,
      retryLastFailed,
      clearChat,
      selectConversation,
      deleteConversation,
      renameConversation,
      rateMessage,
      startVoiceInput,
      stopVoiceInput,
      suggestions,
    ],
  );

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export const useAiChat = () => {
  const ctx = useContext(AiChatContext);
  if (!ctx) {
    throw new Error("useAiChat must be used within AiChatProvider");
  }
  return ctx;
};

export function useRegisterPageContext(
  label: string | null,
  detail?: string | null,
) {
  const { setPageContextOverride } = useAiChat();
  useEffect(() => {
    if (!label) {
      setPageContextOverride(null);
      return () => setPageContextOverride(null);
    }
    setPageContextOverride({ label, detail: detail ?? null });
    return () => setPageContextOverride(null);
  }, [label, detail, setPageContextOverride]);
}
