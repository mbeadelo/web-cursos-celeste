import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ChatbotWidget } from "@/components/chatbot-widget";
import { getChatbotPublicConfig } from "@/lib/chatbot";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Bienvenido a tu plaza",
    template: "%s · Bienvenido a tu plaza",
  },
  description: "Cursos online sobre lo tuyo. Aprende a tu ritmo.",
  metadataBase: new URL("https://bienvenidoatuplaza.com"),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Chatbot config is best-effort: if the lookup fails (e.g. DB hiccup) we just
  // don't render the widget rather than crashing every page.
  let chatbot = null;
  try {
    chatbot = await getChatbotPublicConfig();
  } catch {
    chatbot = null;
  }

  return (
    <html
      lang="es"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        {chatbot?.enabled && (
          <ChatbotWidget
            enabled={chatbot.enabled}
            title={chatbot.title}
            welcome={chatbot.welcome}
            avatar={chatbot.avatar}
          />
        )}
      </body>
    </html>
  );
}
