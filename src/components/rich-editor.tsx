"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichEditor({ value, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Empieza a escribir…",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral max-w-none min-h-[280px] focus:outline-none px-4 py-3",
      },
    },
  });

  // Keep editor content in sync when `value` is reset externally (e.g. form reset).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div className={cn("rounded-md border border-neutral-300 bg-white", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return <div className="h-9 border-b border-neutral-200 bg-neutral-50" />;
  }

  const buttonBase =
    "h-7 px-2 text-xs rounded hover:bg-neutral-100 transition";
  const active = "bg-neutral-200 text-neutral-900";

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label="Negrita"
        baseClass={buttonBase}
        activeClass={active}
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label="Cursiva"
        baseClass={buttonBase}
        activeClass={active}
      >
        <em>I</em>
      </ToolbarButton>
      <Sep />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        label="Encabezado 2"
        baseClass={buttonBase}
        activeClass={active}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        label="Encabezado 3"
        baseClass={buttonBase}
        activeClass={active}
      >
        H3
      </ToolbarButton>
      <Sep />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="Lista"
        baseClass={buttonBase}
        activeClass={active}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="Lista numerada"
        baseClass={buttonBase}
        activeClass={active}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        label="Cita"
        baseClass={buttonBase}
        activeClass={active}
      >
        &ldquo;
      </ToolbarButton>
      <Sep />
      <ToolbarButton
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL:", previous ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
        active={editor.isActive("link")}
        label="Enlace"
        baseClass={buttonBase}
        activeClass={active}
      >
        ↗
      </ToolbarButton>
      <Sep />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        active={false}
        label="Deshacer"
        baseClass={buttonBase}
        activeClass={active}
        disabled={!editor.can().undo()}
      >
        ↶
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        active={false}
        label="Rehacer"
        baseClass={buttonBase}
        activeClass={active}
        disabled={!editor.can().redo()}
      >
        ↷
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  label,
  baseClass,
  activeClass,
  disabled,
  children,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  baseClass: string;
  activeClass: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={cn(
        baseClass,
        active && activeClass,
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-4 bg-neutral-300 mx-1" aria-hidden />;
}
