import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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

const SITE_NAME = "Bienvenido a tu plaza";
const SITE_DESCRIPTION =
  "Cursos online para preparar tu oposición docente a tu ritmo: vídeos, materiales descargables y acompañamiento.";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: "%s · Bienvenido a tu plaza",
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL("https://bienvenidoatuplaza.com"),
  applicationName: SITE_NAME,
  // OG/Twitter por defecto para toda la web. Las páginas hijas (listados,
  // detalle de curso/artículo) sobrescriben title/description/images cuando
  // procede; la imagen la aporta el opengraph-image.tsx de cada segmento.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_ES",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
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
        {/* Vercel Web Analytics — cookieless, first-party. Capta UTMs y
            referrers para trackear campañas. Requiere activar "Web Analytics"
            en el dashboard de Vercel para que fluya el dato. */}
        <Analytics />
      </body>
    </html>
  );
}
