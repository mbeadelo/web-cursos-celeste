import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Rough reading time estimate from HTML or plain text. Strips tags, splits on
 * whitespace, divides by ~200 words/minute (typical Spanish/English reading
 * pace). Always returns at least 1.
 */
export function estimateReadingTimeMinutes(input: string): number {
  const text = input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return 1
  const words = text.split(" ").length
  return Math.max(1, Math.ceil(words / 200))
}
