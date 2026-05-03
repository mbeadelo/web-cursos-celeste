import type { Metadata } from "next";

export const metadata: Metadata = { title: "Revisa tu email" };

export default function VerifyPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4 py-16">
        <h1 className="text-2xl font-semibold">Revisa tu email</h1>
        <p className="text-neutral-600">
          Te hemos enviado un enlace para acceder. El enlace caduca en 24 horas.
        </p>
        <p className="text-sm text-neutral-500">
          Si no lo encuentras, revisa la carpeta de spam.
        </p>
      </div>
    </main>
  );
}
