import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Sanitizer for HTML produced by the TipTap rich editor (`src/components/rich-editor.tsx`)
 * before it is stored and later rendered with `dangerouslySetInnerHTML`.
 *
 * Although every write path is admin-only (`ensureAdmin`), this is defense in
 * depth: it guarantees stored rich copy can never carry a <script>, an inline
 * event handler, or a `javascript:` URL — regardless of how the value reached
 * the server action. Apply it at the WRITE boundary (in the save server
 * actions), so what lands in the DB is already clean and render stays trivial.
 *
 * The allow-list mirrors exactly what the editor can emit (StarterKit headings
 * limited to h2/h3, plus the Link extension). Anything outside it is dropped.
 * Keep the two in sync: if you enable a new TipTap mark/node, add its tag here
 * or it will be silently stripped on save.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "u",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
  "a",
];

export function sanitizeRichHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      // href is scheme-checked below; rel/target must be allow-listed here or
      // the values forced by `transformTags` get stripped afterwards.
      a: ["href", "rel", "target"],
    },
    // Only safe link schemes. `javascript:`, `data:`, `vbscript:` are dropped.
    // Relative and protocol-relative URLs are allowed so editor links and the
    // {{loginUrl}} placeholder in email templates survive.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: true,
    // Normalize every surviving <a> to open safely. This also covers links the
    // editor's autolink created without our HTMLAttributes.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
    // Drop the contents of any disallowed tag entirely (e.g. <script>…</script>
    // loses its body too, not just the tag).
    nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  });
}
