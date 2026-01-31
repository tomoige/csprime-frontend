"use client";

import React, { useState, useRef, useEffect } from "react";
import ChatMarkdown from "@/components/ChatMarkdown";
import LoadingSpinner from "@/components/LoadingSpinner";
import { GraduationCap, RotateCcw, Send, Sparkles, User } from "lucide-react";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

const SUGGESTED_PROMPTS = [
  "What modules should I take in first year?",
  "Explain recursion in Java",
  "How does CS210 connect to CS355?",
  "What is CSPrime and how can it help me?",
];

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content:
        "I'm your Maynooth CS Assistant. Ask me anything about Computer Science modules!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const storedId = localStorage.getItem("session_id");
    if (storedId) {
      setSessionId(storedId);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.content, sessionId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.detail || response.statusText);
      }

      const data = await response.json();

      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
        localStorage.setItem("session_id", data.session_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "I couldn't find an answer to that question.",
        },
      ]);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, something went wrong: ${errorMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const resetChat = () => {
    setSessionId(null);
    localStorage.removeItem("session_id");
    setMessages([
      {
        role: "system",
        content:
          "I'm your Maynooth CS Assistant. Ask me anything about Computer Science modules!",
      },
    ]);
  };

  const displayMessages = messages.filter((m) => m.role !== "system");
  const hasMessages = displayMessages.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-gradient-to-b from-slate-50 to-gray-50">
      {/* Header - minimal, matches site navbar */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100">
            <GraduationCap size={20} className="text-slate-700" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">
            Maynooth CS Assistant
          </h1>
        </div>
        <button
          onClick={resetChat}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        >
          <RotateCcw size={16} />
          New chat
        </button>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {!hasMessages ? (
            /* Welcome / empty state */
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <div className="p-4 rounded-2xl bg-white/80 shadow-sm border border-gray-100 mb-6">
                <Sparkles size={40} className="text-slate-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                How can I help you today?
              </h2>
              <p className="text-slate-600 mb-8 max-w-md">
                Ask about Maynooth CS modules, programming concepts, or how
                topics connect across your degree.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="px-4 py-3 text-left rounded-xl border border-gray-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm transition-all shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message list */
            <div className="space-y-6">
              {displayMessages.map((message, i) => (
                <div
                  key={i}
                  className={`flex gap-4 ${
                    message.role === "user" ? "flex-row" : ""
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <GraduationCap size={18} className="text-slate-600" />
                    </div>
                  )}
                  <div
                    className={`flex-1 max-w-[85%] ${
                      message.role === "user" ? "flex justify-end" : ""
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-slate-800 text-white"
                          : "bg-white border border-gray-100 shadow-sm text-slate-800"
                      }`}
                    >
                      {message.role === "user" ? (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      ) : (
                        <ChatMarkdown content={message.content} />
                      )}
                    </div>
                  </div>
                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white">
                      <User size={18} />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <GraduationCap size={18} className="text-slate-600" />
                  </div>
                  <div className="flex-1 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500">
                      <LoadingSpinner size="sm" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input area - ChatGPT style */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <form
            ref={formRef}
            onSubmit={sendMessage}
            className="flex gap-3 items-end p-2 rounded-2xl border border-gray-200 bg-white shadow-sm hover:border-gray-300 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              placeholder="Ask about modules, programming, or the CS degree..."
              disabled={loading}
              rows={1}
              className="flex-1 min-h-[44px] max-h-32 px-4 py-3 resize-none bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-800 placeholder:text-slate-400 text-[15px] leading-relaxed"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex-shrink-0 p-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800 transition-colors"
            >
              <Send size={20} />
            </button>
          </form>
          <p className="text-center text-xs text-slate-400 mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
