import React, { useEffect } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
} from "lucide-react";

/**
 * Borderless, Notion/Linear-style block editor.
 *
 * - HTML in / HTML out (drop-in for the old Quill-based editor)
 * - No persistent toolbar
 * - Markdown shortcuts from StarterKit: "# " → H1, "## " → H2, "- " → bullet,
 *   "1. " → ordered, "[] " → checkbox, "> " → quote, "```" → code block, ---
 *   → divider, **bold** / *italic* / `code` inline.
 * - Floating bubble menu appears on text selection with inline formatting.
 * - Task-list extension gives Notion-style todo checkboxes inside prose.
 */
export default function NotionEditor({
  value,
  onChange,
  placeholder = "Write something, or type / for commands…",
  autoFocus = false,
  className = "",
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "notion-code" } },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-indigo-600 underline underline-offset-2",
          rel: "noopener noreferrer nofollow",
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: value || "",
    autofocus: autoFocus,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      // Treat an empty editor as empty string (Tiptap leaves <p></p>)
      if (html === "<p></p>") {
        onChange?.("");
      } else {
        onChange?.(html);
      }
    },
    editorProps: {
      attributes: {
        class:
          "notion-editor prose prose-sm max-w-none focus:outline-none text-[14px] leading-relaxed text-gray-800",
      },
    },
  });

  // Keep external `value` in sync without interfering with ongoing edits.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || "";
    if (incoming && incoming !== current) {
      editor.commands.setContent(incoming, false);
    } else if (!incoming && current !== "<p></p>") {
      editor.commands.clearContent(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const promptLink = () => {
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("URL", previous);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };

  const BtnClass = (active) =>
    `p-1.5 rounded hover:bg-gray-100 ${
      active ? "bg-gray-100 text-gray-900" : "text-gray-600"
    }`;

  return (
    <div className={`notion-editor-wrapper ${className}`}>
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 120, placement: "top" }}
        className="flex items-center gap-0.5 p-1 rounded-lg border border-gray-200 bg-white shadow-lg"
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={BtnClass(editor.isActive("bold"))}
          title="Bold ⌘B"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={BtnClass(editor.isActive("italic"))}
          title="Italic ⌘I"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={BtnClass(editor.isActive("underline"))}
          title="Underline ⌘U"
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={BtnClass(editor.isActive("strike"))}
          title="Strikethrough"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={BtnClass(editor.isActive("code"))}
          title="Inline code"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={promptLink}
          className={BtnClass(editor.isActive("link"))}
          title="Link"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-0.5" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={BtnClass(editor.isActive("heading", { level: 1 }))}
          title="Heading 1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={BtnClass(editor.isActive("heading", { level: 2 }))}
          title="Heading 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={BtnClass(editor.isActive("bulletList"))}
          title="Bullet list"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={BtnClass(editor.isActive("orderedList"))}
          title="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={BtnClass(editor.isActive("taskList"))}
          title="Checklist"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={BtnClass(editor.isActive("blockquote"))}
          title="Quote"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>
      </BubbleMenu>

      <EditorContent editor={editor} />

      <style>{`
        .notion-editor {
          min-height: 72px;
        }
        .notion-editor p {
          margin: 0.25rem 0;
        }
        .notion-editor h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem;
          line-height: 1.25;
        }
        .notion-editor h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.875rem 0 0.375rem;
          line-height: 1.3;
        }
        .notion-editor h3 {
          font-size: 1.05rem;
          font-weight: 600;
          margin: 0.75rem 0 0.25rem;
        }
        .notion-editor ul,
        .notion-editor ol {
          padding-left: 1.25rem;
          margin: 0.25rem 0;
        }
        .notion-editor ul li,
        .notion-editor ol li {
          margin: 0.125rem 0;
        }
        .notion-editor ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }
        .notion-editor ul[data-type="taskList"] > li {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
        }
        .notion-editor ul[data-type="taskList"] > li > label {
          margin-top: 0.3rem;
        }
        .notion-editor ul[data-type="taskList"] > li > label input[type="checkbox"] {
          cursor: pointer;
        }
        .notion-editor ul[data-type="taskList"] > li > div {
          flex: 1;
          min-width: 0;
        }
        .notion-editor ul[data-type="taskList"] > li[data-checked="true"] > div {
          color: #9ca3af;
          text-decoration: line-through;
        }
        .notion-editor blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 0.75rem;
          color: #6b7280;
          margin: 0.5rem 0;
        }
        .notion-editor code {
          background: #f3f4f6;
          padding: 0.1rem 0.3rem;
          border-radius: 0.25rem;
          font-size: 0.85em;
        }
        .notion-editor pre {
          background: #111827;
          color: #f9fafb;
          padding: 0.75rem 0.875rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 0.5rem 0;
          font-size: 0.85em;
        }
        .notion-editor pre code {
          background: transparent;
          padding: 0;
          color: inherit;
        }
        .notion-editor hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1rem 0;
        }
        .notion-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
