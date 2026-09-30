"use client";

import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { useEffect } from "react";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Minimum height of the writing area. */
  minHeight?: number;
  "aria-label"?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Explain what changed and why it matters to customers…",
  className,
  minHeight = 180,
  "aria-label": ariaLabel = "Release description",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "sb-prose tiptap px-4 py-3 focus:outline-none",
        style: `min-height:${minHeight}px`,
        "aria-label": ariaLabel,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.isEmpty ? "" : ed.getHTML());
    },
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed?.isActive("bold") ?? false,
      italic: ed?.isActive("italic") ?? false,
      heading: ed?.isActive("heading", { level: 2 }) ?? false,
      bullet: ed?.isActive("bulletList") ?? false,
      ordered: ed?.isActive("orderedList") ?? false,
      quote: ed?.isActive("blockquote") ?? false,
      link: ed?.isActive("link") ?? false,
      canUndo: ed?.can().undo() ?? false,
      canRedo: ed?.can().redo() ?? false,
    }),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div className={cn("overflow-hidden rounded-lg border border-input bg-surface", className)}>
        <div className="h-9 border-b border-border bg-surface-subtle/60" />
        <div className="space-y-2 p-4" style={{ minHeight }}>
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Link URL");
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-surface transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40",
        className
      )}
    >
      <div role="toolbar" aria-label="Formatting" className="sb-scrollbar-none flex items-center gap-0.5 overflow-x-auto border-b border-border bg-surface-subtle/60 px-1.5 py-1">
        <ToolbarButton icon={Bold} label="Bold" active={active?.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton icon={Italic} label="Italic" active={active?.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarDivider />
        <ToolbarButton icon={Heading2} label="Heading" active={active?.heading} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton icon={List} label="Bulleted list" active={active?.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton icon={ListOrdered} label="Numbered list" active={active?.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton icon={Quote} label="Quote" active={active?.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton icon={Link2} label={active?.link ? "Remove link" : "Add link"} active={active?.link} onClick={toggleLink} />
        <span className="ml-auto flex items-center gap-0.5">
          <ToolbarButton icon={Undo2} label="Undo" disabled={!active?.canUndo} onClick={() => editor.chain().focus().undo().run()} />
          <ToolbarButton icon={Redo2} label="Redo" disabled={!active?.canRedo} onClick={() => editor.chain().focus().redo().run()} />
        </span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-surface text-foreground ring-1 ring-border"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />;
}

export function RichTextPreview({
  html,
  className,
  compact = false,
  emptyText = "Nothing written yet.",
}: {
  html: string;
  className?: string;
  compact?: boolean;
  emptyText?: string;
}) {
  if (!html || html === "<p></p>") {
    return <p className={cn("text-sm text-muted-foreground italic", className)}>{emptyText}</p>;
  }

  return (
    <div
      className={cn("sb-prose", compact && "sb-prose-compact", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
