jest.mock("../api/ai.api", () => ({
  streamChatWithAI: jest.fn(),
  getChatHistory: jest.fn().mockResolvedValue({ success: true, data: [] }),
  listConversations: jest.fn().mockResolvedValue({ success: true, data: [] }),
  deleteConversation: jest.fn().mockResolvedValue({ success: true }),
  renameConversation: jest.fn().mockResolvedValue({ success: true }),
  submitMessageFeedback: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ status: "authenticated" }),
}));

import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { AiChatProvider, useAiChat } from "./AiChatProvider";
import { streamChatWithAI, submitMessageFeedback } from "../api/ai.api";

const mockedStream = streamChatWithAI as jest.MockedFunction<typeof streamChatWithAI>;
const mockedFeedback = submitMessageFeedback as jest.MockedFunction<
  typeof submitMessageFeedback
>;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AiChatProvider>{children}</AiChatProvider>
    </MemoryRouter>
  );
}

describe("AiChatProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockedStream.mockReset();
    mockedFeedback.mockReset();
    mockedFeedback.mockResolvedValue({ success: true });
    mockedStream.mockImplementation(() => {
      return () => undefined;
    });
  });

  it("stopGeneration clears isSending", async () => {
    mockedStream.mockImplementation((_m, _h, _c, _onToken, _onDone, onError) => {
      return () => {
        onError("");
      };
    });

    const { result } = renderHook(() => useAiChat(), { wrapper });

    act(() => {
      result.current.sendMessage("תסביר לי את מדרגות המס");
    });
    expect(result.current.isSending).toBe(true);

    act(() => {
      result.current.stopGeneration();
    });
    expect(result.current.isSending).toBe(false);
  });

  it("retryLastFailed resends the failed question", async () => {
    mockedStream
      .mockImplementationOnce((_m, _h, _c, _onToken, _onDone, onError) => {
        onError("שגיאה זמנית");
        return () => undefined;
      })
      .mockImplementationOnce((_m, _h, _c, _onToken, onDone) => {
        onDone("rule", "conv-2");
        return () => undefined;
      });

    const { result } = renderHook(() => useAiChat(), { wrapper });

    act(() => {
      result.current.sendMessage("כמה נטו?");
    });

    await waitFor(() => {
      expect(result.current.lastFailedUserMessage).toBe("כמה נטו?");
      expect(result.current.isSending).toBe(false);
    });

    act(() => {
      result.current.retryLastFailed();
    });

    await waitFor(() => {
      expect(mockedStream).toHaveBeenCalledTimes(2);
      expect(result.current.lastFailedUserMessage).toBeNull();
    });
  });

  it("stores contextUsed and citations from stream done meta", async () => {
    mockedStream.mockImplementation((_m, _h, _c, _onToken, onDone) => {
      onDone("rule", "conv-1", {
        contextUsed: ["latest payslip"],
        citations: [{ type: "payslip", label: "תלוש אחרון", href: "/documents/history" }],
        latencyMs: 12,
        messageId: "msg-1",
      });
      return () => undefined;
    });

    const { result } = renderHook(() => useAiChat(), { wrapper });

    act(() => {
      result.current.sendMessage("תן לי סיכום פיננסי");
    });

    await waitFor(() => {
      const assistant = result.current.messages.find(
        (m) => m.role === "assistant" && m.contextUsed?.length,
      );
      expect(assistant?.contextUsed).toEqual(["latest payslip"]);
      expect(assistant?.citations?.[0]?.href).toBe("/documents/history");
      expect(assistant?.latencyMs).toBe(12);
      expect(assistant?.id).toBe("msg-1");
      expect(result.current.isSending).toBe(false);
    });
  });

  it("sends empty history to the server", async () => {
    mockedStream.mockImplementation((_m, history, _c, _onToken, onDone) => {
      expect(history).toEqual([]);
      onDone("rule", "conv-x");
      return () => undefined;
    });

    const { result } = renderHook(() => useAiChat(), { wrapper });

    act(() => {
      result.current.sendMessage("שאלה ראשונה");
    });

    await waitFor(() => expect(result.current.isSending).toBe(false));

    act(() => {
      result.current.sendMessage("שאלה שנייה");
    });

    await waitFor(() => {
      expect(mockedStream).toHaveBeenCalled();
      const lastHistory = mockedStream.mock.calls.at(-1)?.[1];
      expect(lastHistory).toEqual([]);
    });
  });

  it("applies Retry-After from rate-limit error info", async () => {
    mockedStream.mockImplementation((_m, _h, _c, _onToken, _onDone, onError) => {
      onError("חרגת ממגבלת השאלות לעוזר. נסו שוב בעוד כמה דקות.", {
        message: "חרגת ממגבלת השאלות לעוזר. נסו שוב בעוד כמה דקות.",
        retryAfterSec: 12,
      });
      return () => undefined;
    });

    const { result } = renderHook(() => useAiChat(), { wrapper });
    const before = Date.now();

    act(() => {
      result.current.sendMessage("עוד שאלה");
    });

    await waitFor(() => {
      expect(result.current.rateLimitedUntil).not.toBeNull();
      expect(result.current.rateLimitedUntil!).toBeGreaterThanOrEqual(before + 11_000);
      expect(result.current.rateLimitedUntil!).toBeLessThanOrEqual(before + 13_500);
    });
  });

  it("rateMessage posts feedback", async () => {
    mockedStream.mockImplementation((_m, _h, _c, _onToken, onDone) => {
      onDone("rule", "conv-fb", { messageId: "fb-msg-1" });
      return () => undefined;
    });

    const { result } = renderHook(() => useAiChat(), { wrapper });

    act(() => {
      result.current.sendMessage("כמה נטו?");
    });

    await waitFor(() => {
      expect(result.current.messages.some((m) => m.id === "fb-msg-1")).toBe(true);
    });

    await act(async () => {
      await result.current.rateMessage("fb-msg-1", 1);
    });

    expect(mockedFeedback).toHaveBeenCalledWith("fb-msg-1", 1);
    expect(
      result.current.messages.find((m) => m.id === "fb-msg-1")?.feedbackRating,
    ).toBe(1);
  });

  it("closePanel stops listening", async () => {
    const { result } = renderHook(() => useAiChat(), { wrapper });

    act(() => {
      result.current.openPanel();
    });
    expect(result.current.isPanelOpen).toBe(true);

    act(() => {
      result.current.closePanel();
    });
    expect(result.current.isPanelOpen).toBe(false);
    expect(result.current.isListening).toBe(false);
  });
});
