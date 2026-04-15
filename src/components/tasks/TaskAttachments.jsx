import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { TaskAttachment } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import {
  Upload,
  X,
  Loader2,
  FileText,
  Image as ImageIcon,
  FileArchive,
  File as FileIcon,
  Download,
  Trash2,
} from "lucide-react";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(type) {
  if (!type) return FileIcon;
  if (type.startsWith("image/")) return ImageIcon;
  if (type.includes("pdf") || type.includes("document") || type.includes("text")) return FileText;
  if (type.includes("zip") || type.includes("compressed")) return FileArchive;
  return FileIcon;
}

/**
 * TaskAttachments
 *
 * - If `taskId` is provided: manages attachments live (loads, uploads, deletes).
 * - If `taskId` is null: pure-pending mode. Tracks selected files in `pendingFiles`
 *   via `onPendingChange`. Parent uploads them after task creation.
 */
export default function TaskAttachments({
  taskId = null,
  pendingFiles = [],
  onPendingChange,
}) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const isPendingMode = !taskId;

  const loadAttachments = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const data = await TaskAttachment.filter({ task_id: taskId }, "-created_at");
      setAttachments(data || []);
    } catch (err) {
      console.error("Error loading attachments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) loadAttachments();
  }, [taskId]);

  const validateFile = (file) => {
    if (file.size > MAX_SIZE) {
      return `"${file.name}" is too large (max 25 MB)`;
    }
    return null;
  };

  const uploadOne = async (file) => {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const safeBase = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 80);
    const path = `tasks/${taskId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${safeBase}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const record = await TaskAttachment.create({
      task_id: taskId,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || null,
      uploaded_by: user?.id || null,
    });
    return record;
  };

  const handleFiles = async (files) => {
    setError("");
    const arr = Array.from(files || []);
    if (arr.length === 0) return;

    const tooBig = arr.find(validateFile);
    if (tooBig) {
      setError(validateFile(tooBig));
      return;
    }

    if (isPendingMode) {
      onPendingChange?.([...(pendingFiles || []), ...arr]);
      return;
    }

    setUploading(true);
    try {
      const uploaded = [];
      for (const f of arr) {
        const rec = await uploadOne(f);
        uploaded.push(rec);
      }
      setAttachments((prev) => [...uploaded, ...prev]);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (att) => {
    try {
      const { data, error: signErr } = await supabase.storage
        .from("uploads")
        .createSignedUrl(att.file_path, 3600);
      if (signErr) throw signErr;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Download failed:", err);
      setError(err.message || "Download failed");
    }
  };

  const handleDelete = async (att) => {
    if (!window.confirm(`Delete "${att.file_name}"?`)) return;
    try {
      await supabase.storage.from("uploads").remove([att.file_path]);
      await TaskAttachment.delete(att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch (err) {
      console.error("Delete failed:", err);
      setError(err.message || "Delete failed");
    }
  };

  const removePending = (idx) => {
    onPendingChange?.((pendingFiles || []).filter((_, i) => i !== idx));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const items = isPendingMode
    ? pendingFiles.map((f, i) => ({
        id: `pending-${i}`,
        file_name: f.name,
        file_size: f.size,
        file_type: f.type,
        _pending: true,
        _index: i,
      }))
    : attachments;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <FileIcon className="w-3.5 h-3.5 text-gray-400" />
        Attachments
        {items.length > 0 && (
          <span className="text-xs text-gray-400 font-normal">({items.length})</span>
        )}
      </Label>

      {/* List */}
      {loading ? (
        <div className="text-xs text-gray-400 px-2 py-3">Loading…</div>
      ) : items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((att) => {
            const Icon = fileIcon(att.file_type);
            return (
              <li
                key={att.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900 truncate">{att.file_name}</div>
                  <div className="text-xs text-gray-400">
                    {formatBytes(att.file_size)}
                    {att._pending && " · pending — will upload on save"}
                  </div>
                </div>
                {!att._pending && (
                  <button
                    type="button"
                    onClick={() => handleDownload(att)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    att._pending ? removePending(att._index) : handleDelete(att)
                  }
                  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                  title={att._pending ? "Remove" : "Delete"}
                >
                  {att._pending ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-200 hover:border-gray-300"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 mx-auto text-indigo-500 animate-spin" />
        ) : (
          <>
            <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1.5" />
            <p className="text-sm text-gray-500">
              Drop files here or{" "}
              <span className="text-indigo-600 font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Any file type, up to 25 MB</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
