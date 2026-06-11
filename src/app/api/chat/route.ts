import { z } from "zod";
import {
  isChatbotConfigured,
  getChatbotPublicConfig,
  buildChatbotSystemPrompt,
  anthropic,
  CHATBOT_MODEL,
  CHATBOT_MAX_TOKENS,
  CHATBOT_MAX_HISTORY,
} from "@/lib/chatbot";
import { chatIpLimiter, chatIpHourLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      })
    )
    .min(1)
    .max(40),
});

/**
 * POST /api/chat — streamed support-chatbot reply.
 *
 * Public (no auth) but gated three ways: the API key must exist, the admin must
 * have switched the bot on, and the IP must be under the per-minute/hour rate
 * limit. Spends Anthropic tokens, so input is bounded (history truncated,
 * message length capped) and output is capped at CHATBOT_MAX_TOKENS.
 */
export async function POST(req: Request) {
  // Honor the admin off-switch even on direct calls (don't spend tokens).
  const config = await getChatbotPublicConfig();
  if (!config.enabled) {
    return new Response("Chatbot desactivado", { status: 503 });
  }

  const ip = getClientIp(req.headers);
  const [perMin, perHour] = await Promise.all([
    chatIpLimiter.limit(ip),
    chatIpHourLimiter.limit(ip),
  ]);
  if (!perMin.success || !perHour.success) {
    return new Response("Demasiados mensajes. Prueba en un momento.", {
      status: 429,
    });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return new Response("Petición inválida", { status: 400 });
  }

  // Keep the last N messages and ensure the turn starts with a user message
  // (Anthropic requires the first message to be `user`).
  let messages = body.messages.slice(-CHATBOT_MAX_HISTORY);
  while (messages[0] && messages[0].role !== "user") {
    messages = messages.slice(1);
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    return new Response("Conversación inválida", { status: 400 });
  }

  // Preview mode: the widget is switched on but the API key isn't set yet.
  // Reply with a fixed message so the look & feel can be tried end-to-end
  // without spending (or needing) Anthropic credit.
  if (!isChatbotConfigured()) {
    return plainStream(
      "👋 ¡Hola! Estoy en modo vista previa: el equipo todavía me está poniendo a punto, " +
        "así que aún no puedo responder a tus preguntas. Muy pronto estaré lista para ayudarte " +
        "con dudas sobre los cursos y la plataforma. ¡Gracias por tu paciencia!"
    );
  }

  const system = await buildChatbotSystemPrompt();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const llm = anthropic().messages.stream({
          model: CHATBOT_MODEL,
          max_tokens: CHATBOT_MAX_TOKENS,
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        llm.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });
        await llm.finalMessage();
        controller.close();
      } catch (err) {
        console.error("[chat] error de streaming:", err);
        try {
          controller.enqueue(
            encoder.encode(
              "\n\nUf, algo ha fallado por mi parte. Inténtalo de nuevo en un momento."
            )
          );
        } catch {
          // controller may already be closed; ignore.
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Stream a fixed string back in the same text/plain shape the widget reads. */
function plainStream(text: string): Response {
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
