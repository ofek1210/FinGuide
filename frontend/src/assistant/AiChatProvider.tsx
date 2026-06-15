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
import {
  streamChatWithAI,
  getChatHistory,
  listConversations,
  type ConversationMessage,
  type ConversationSummary,
} from "../api/ai.api";
import { useAuth } from "../auth/AuthProvider";

const AI_CHAT_STORAGE_KEY = "finguide_ai_chat";
const AI_CONVERSATION_ID_KEY = "finguide_conversation_id";
const AI_PANEL_OPEN_KEY = "finguide_ai_chat_open";
const MAX_HISTORY_TURNS = 6;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
  contextUsed?: string[];
  isStreaming?: boolean;
};

export const AI_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "שלום! אני העוזר הפיננסי החכם של FinGuide, מופעל על ידי Claude AI.\n\nאני יכול לענות על שאלות כמו:\n- **כמה שכר נטו קיבלת** החודש\n- **ניתוח הפרשות פנסיה** ביחס לחובה החוקית\n- **סימולציה**: מה יקרה אם תקבל העלאה של 10%?\n- **זיהוי חריגות** בתלוש השכר\n- **שאלות כלליות** על מס, ביטוח לאומי, קרן השתלמות\n\nשאל/י אותי כל שאלה פיננסית!",
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
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  sendMessage: (text: string) => void;
  clearChat: () => void;
  selectConversation: (conversationId: string) => void;
  startVoiceInput: (onTranscript: (text: string) => void) => void;
};

const AiChatContext = createContext<AiChatContextValue | null>(null);

function saveMessages(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}

function buildHistory(messages: ChatMessage[]): ConversationMessage[] {
  return messages
    .filter((m) => m.id !== "welcome")
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));
}

export function AiChatProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";

  const [messages, setMessages] = useState<ChatMessage[]>([AI_WELCOME_MESSAGE]);
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

  const streamAbortRef = useRef<(() => void) | null>(null);

  // Load server-side history when a conversation is selected.
  useEffect(() => {
    if (!isAuthenticated || !conversationId) return;
    void getChatHistory(conversationId).then((res) => {
      if (!res.success || !res.data?.length) return;
      const loaded: ChatMessage[] = res.data
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m._id,
          role: m.role as "user" | "assistant",
          content: m.content,
          source: m.metadata?.model ?? m.metadata?.intent,
          contextUsed: m.metadata?.contextUsed,
        }));
      if (loaded.length) setMessages(loaded);
    });
  }, [conversationId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void listConversations().then((res) => {
      if (res.success && res.data) setConversations(res.data);
    });
  }, [messages.length, isAuthenticated]);

  useEffect(() => {
    if (conversationId) sessionStorage.setItem(AI_CONVERSATION_ID_KEY, conversationId);
  }, [conversationId]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    sessionStorage.setItem(AI_PANEL_OPEN_KEY, isPanelOpen ? "1" : "0");
  }, [isPanelOpen]);

  // Abort any in-flight stream on unmount.
  useEffect(() => {
    return () => streamAbortRef.current?.();
  }, []);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);
  const togglePanel = useCallback(() => setIsPanelOpen((prev) => !prev), []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      let history: ConversationMessage[] = [];
      setMessages((prev) => {
        history = buildHistory(prev);
        const next = [...prev, userMessage];
        saveMessages(next);
        return next;
      });
      setError("");
      setIsSending(true);

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", isStreaming: true },
      ]);

      const abort = streamChatWithAI(
        trimmed,
        history,
        conversationId,
        (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m,
            ),
          );
        },
        (source, convId) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false, source } : m,
            ),
          );
          setConversationId(convId);
          setIsSending(false);
        },
        (errMsg) => {
          setError(errMsg);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setIsSending(false);
        },
      );

      streamAbortRef.current = abort;
    },
    [conversationId, isSending],
  );

  const clearChat = useCallback(() => {
    streamAbortRef.current?.();
    setMessages([AI_WELCOME_MESSAGE]);
    setConversationId(null);
    sessionStorage.removeItem(AI_CONVERSATION_ID_KEY);
    setError("");
    setIsSending(false);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setConversationId(id);
  }, []);

  const startVoiceInput = useCallback(
    (onTranscript: (text: string) => void) => {
      if (!SpeechRecognitionAPI || isListening || isSending) return;
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = "he-IL";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript ?? "";
        if (transcript) onTranscript(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setError("גישה למיקרופון נדחתה. אפשרו גישה בדפדפן ונסו שוב.");
        } else if (event.error === "no-speech") {
          setError("לא זוהה דיבור. נסו שוב.");
        } else {
          setError("שגיאה בקלט הקולי. נסו שוב.");
        }
      };

      recognition.onend = () => setIsListening(false);

      try {
        recognition.start();
        setIsListening(true);
      } catch {
        setError("לא ניתן להפעיל את המיקרופון.");
      }
    },
    [isListening, isSending],
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
      openPanel,
      closePanel,
      togglePanel,
      sendMessage,
      clearChat,
      selectConversation,
      startVoiceInput,
    }),
    [
      messages,
      conversationId,
      conversations,
      isSending,
      isListening,
      error,
      isPanelOpen,
      openPanel,
      closePanel,
      togglePanel,
      sendMessage,
      clearChat,
      selectConversation,
      startVoiceInput,
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
