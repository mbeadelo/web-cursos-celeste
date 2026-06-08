"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestSiteImageUploadUrl } from "./_actions";

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** When false, hides the file picker and only shows the URL input. */
  storageEnabled: boolean;
};

/**
 * Image picker for site-content `image` keys. Uploads directly to R2 via a
 * signed PUT URL (like the course cover uploader) and stores the resulting
 * public URL as the field value. Also accepts a pasted URL as a fallback.
 */
export function ImageField({ value, onChange, storageEnabled }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<"idle" | "signing" | "uploading">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setError(null);
    setProgress("signing");

    const signed = await requestSiteImageUploadUrl({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    });

    if (!signed.ok) {
      setError(signed.error);
      setProgress("idle");
      return;
    }

    setProgress("uploading");
    try {
      const res = await fetch(signed.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!res.ok) throw new Error(`Upload falló (${res.status})`);
      onChange(signed.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error subiendo el archivo");
    } finally {
      setProgress("idle");
    }
  }

  return (
    <div className="space-y-3">
      {value && (
        <div className="relative size-28 rounded-full border border-neutral-200 overflow-hidden bg-neutral-100">
          {/* Plain img so we don't need to whitelist arbitrary domains in next.config */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Imagen actual" className="size-full object-cover" />
        </div>
      )}

      {storageEnabled && (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={onFileSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={progress !== "idle"}
          >
            {progress === "signing" && "Pidiendo URL…"}
            {progress === "uploading" && "Subiendo…"}
            {progress === "idle" && (value ? "Cambiar imagen" : "Subir imagen")}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              className="text-red-600"
            >
              Quitar
            </Button>
          )}
        </div>
      )}

      <Input
        type="url"
        placeholder={storageEnabled ? "...o pega una URL" : "https://..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
      {!storageEnabled && (
        <p className="text-xs text-neutral-500">
          Cloudflare R2 no está configurado en este entorno. Solo se admite URL
          externa por ahora.
        </p>
      )}
    </div>
  );
}
