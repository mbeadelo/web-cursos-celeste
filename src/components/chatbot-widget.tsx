"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Floating support chatbot. Rendered by the root layout only when the admin has
 * switched it on and the API key exists. Talks to /api/chat (same origin) and
 * streams the reply. The welcome message is shown as the first assistant turn;
 * the server drops that leading assistant message before calling the model.
 */
export function ChatbotWidget({
  enabled,
  title,
  welcome,
  avatar,
}: {
  enabled: boolean;
  title: string;
  welcome: string;
  avatar: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: welcome },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open]);

  // Don't show on the admin panel — it's a customer-facing widget.
  if (!enabled || pathname?.startsWith("/admin")) return null;

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    // Add an empty assistant message we'll stream into.
    setMessages([...next, { role: "assistant", content: "" }]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const msg =
          res.status === 429
            ? "Vas muy rápido 😅 dame un momento y vuelve a intentarlo."
            : "Ahora mismo no puedo responder. Prueba en un rato o escribe al email de contacto.";
        setMessages([...next, { role: "assistant", content: msg }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            "Se ha cortado la conexión. Inténtalo otra vez en un momento.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar chat" : "Abrir chat de ayuda"}
        className="fixed bottom-5 right-5 z-50 size-14 rounded-full overflow-hidden ring-2 ring-white shadow-lg bg-white transition hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-celeste/50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt=""
          className="size-full object-cover"
        />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex w-[min(92vw,24rem)] h-[min(70vh,34rem)] flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-foreground/15 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-brand-celeste to-brand-magenta px-4 py-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt=""
              className="size-9 rounded-full object-cover ring-2 ring-white/40"
            />
            <div className="min-w-0">
              <p className="font-semibold leading-tight truncate">{title}</p>
              <p className="text-[11px] text-white/80 leading-tight">
                Asistente virtual · IA
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="ml-auto rounded-full p-1 hover:bg-white/15 transition"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-neutral-50"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user" ? "flex justify-end" : "flex justify-start"
                }
              >
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap " +
                    (m.role === "user"
                      ? "bg-brand-celeste text-brand-celeste-foreground rounded-br-sm"
                      : "bg-white ring-1 ring-foreground/10 text-neutral-800 rounded-bl-sm")
                  }
                >
                  {m.content || (sending ? "…" : "")}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 border-t border-neutral-200 bg-white p-2.5"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Escribe tu pregunta…"
              className="flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-brand-celeste max-h-28"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="shrink-0 rounded-xl bg-brand-celeste text-brand-celeste-foreground px-4 py-2 text-sm font-medium hover:bg-brand-celeste-deep transition disabled:opacity-50"
            >
              {sending ? "…" : "Enviar"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
