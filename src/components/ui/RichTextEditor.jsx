import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    ["link"],
    ["clean"],
  ],
};

const formats = [
  "header",
  "bold", "italic", "underline", "strike",
  "list", "bullet", "indent",
  "link",
];

export default function RichTextEditor({ value, onChange, placeholder = "Add a description...", minHeight = 150 }) {
  return (
    <div className="rich-text-editor">
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{ minHeight }}
      />
      <style>{`
        .rich-text-editor .ql-container {
          min-height: ${minHeight}px;
          font-size: 0.875rem;
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
        }
        .rich-text-editor .ql-toolbar {
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
          background: hsl(var(--muted) / 0.4);
        }
        .rich-text-editor .ql-editor {
          min-height: ${minHeight}px;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          font-style: normal;
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
}

/** Strip HTML tags — use for plain-text previews and search */
export function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
