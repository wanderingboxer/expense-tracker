"use client";

import { useState, useRef, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  User,
  Sparkles,
  MessageSquare,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const SUGGESTED_QUESTIONS = [
  "How much did I spend this month?",
  "What are my top expenses?",
  "Show my subscriptions",
  "Compare this month vs last month",
  "How can I save more?",
  "What is my savings rate?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your AI financial assistant. I can help you understand your spending patterns, track budgets, and provide personalized financial advice. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), history: messages }),
      });

      let reply = "I apologize, but I could not process your request right now. Please try again.";
      if (r.ok) {
        const d = await r.json();
        if (d?.reply) reply = d.reply;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "I am having trouble connecting right now. Please check your connection and try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Financial Assistant
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Ask questions about your finances
        </p>
      </div>

      {/* Messages area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-emerald-600 text-white rounded-br-md"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={cn(
                    "text-xs mt-1",
                    msg.role === "user"
                      ? "text-emerald-200"
                      : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  {msg.timestamp.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-32"
              style={{ minHeight: "44px" }}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="h-11 w-11 p-0 rounded-xl shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
