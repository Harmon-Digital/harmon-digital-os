import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Upload,
  X,
  Image as ImageIcon,
  Link as LinkIcon,
  Hash as HashIcon,
  Loader2,
  ChevronDown,
  Building2,
  User as UserIcon,
  Calendar as CalendarIcon,
  FileText,
  Trash2,
} from "lucide-react";
import { PostStatusIcon, PostStatusPicker, PlatformChip, STATUS_LIST } from "./PostIcons";

const PLATFORM_LIMITS = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
};

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "Twitter" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
];

function initialsOf(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PropertyRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-[32px]">
      <div className="flex items-center gap-1.5 w-28 shrink-0 text-[12px] text-gray-500">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function AssigneePicker({ value, teamMembers, onChange }) {
  const selected = teamMembers.find((tm) => tm.id === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-gray-700 hover:bg-gray-100 max-w-full"
        >
          {selected ? (
            <>
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
                {initialsOf(selected.full_name)}
              </div>
              <span className="truncate">{selected.full_name}</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400">
                ?
              </div>
              <span className="text-gray-500">Unassigned</span>
            </>
          )}
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1 max-h-64 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
            !value ? "bg-gray-100 font-medium" : ""
          }`}
        >
          Unassigned
        </button>
        {teamMembers
          .filter((tm) => tm.status === "active")
          .map((tm) => (
            <button
              key={tm.id}
              type="button"
              onClick={() => onChange(tm.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 flex items-center gap-2 ${
                value === tm.id ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
                {initialsOf(tm.full_name)}
              </div>
              <span className="truncate">{tm.full_name}</span>
            </button>
          ))}
      </PopoverContent>
    </Popover>
  );
}

function AccountPicker({ value, accounts, onChange }) {
  const selected = accounts.find((a) => a.id === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-gray-700 hover:bg-gray-100 max-w-full"
        >
          <Building2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="truncate">{selected ? selected.company_name : "None"}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1 max-h-80 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
            !value ? "bg-gray-100 font-medium" : ""
          }`}
        >
          No account
        </button>
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 truncate ${
              value === a.id ? "bg-gray-100 font-medium" : ""
            }`}
          >
            {a.company_name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default function SocialPostForm({
  socialPost,
  accounts = [],
  teamMembers = [],
  onSubmit,
  onAutoSave,
  onCancel,
}) {
  const isEdit = !!socialPost?.id;

  const [formData, setFormData] = useState(
    socialPost || {
      title: "",
      content: "",
      platforms: [],
      scheduled_date: "",
      status: "draft",
      image_url: "",
      client_id: "",
      assigned_to: "",
      hashtags: "",
      link_url: "",
      notes: "",
    },
  );
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    () =>
      !!(
        socialPost?.hashtags ||
        socialPost?.link_url ||
        socialPost?.client_id ||
        socialPost?.assigned_to ||
        socialPost?.notes
      ),
  );
  const fileInputRef = useRef(null);

  const statusLabel = STATUS_LIST.find((s) => s.id === formData.status)?.label || "Status";

  const cleanData = (d = formData) => ({
    ...d,
    client_id: d.client_id || null,
    assigned_to: d.assigned_to || null,
    image_url: d.image_url || null,
    hashtags: d.hashtags || null,
    link_url: d.link_url || null,
    notes: d.notes || null,
  });

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    onSubmit(cleanData());
  };

  /* ---- Auto-save ---- */
  const [saveState, setSaveState] = useState("idle");
  const autoSaveTimer = useRef(null);
  const lastSerialized = useRef(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!isEdit || !onAutoSave) return;
    const serialized = JSON.stringify(cleanData());
    if (firstRun.current) {
      firstRun.current = false;
      lastSerialized.current = serialized;
      return;
    }
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;

    setSaveState("saving");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await onAutoSave(JSON.parse(serialized));
        setSaveState("saved");
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSaveState("error");
      }
    }, 500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isEdit, onAutoSave]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 1500);
    return () => clearTimeout(t);
  }, [saveState]);

  /* ---- Platforms ---- */
  const togglePlatform = (platform) => {
    const current = formData.platforms || [];
    setFormData({
      ...formData,
      platforms: current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform],
    });
  };

  /* ---- Image upload ---- */
  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return;
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `social/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("uploads").getPublicUrl(fileName);
      setFormData({ ...formData, image_url: publicUrl });
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const contentLength = (formData.content || "").length;
  const selectedPlatforms = formData.platforms || [];
  const lowestLimit =
    selectedPlatforms.length > 0
      ? Math.min(...selectedPlatforms.map((p) => PLATFORM_LIMITS[p] || 99999))
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title — borderless */}
      <Textarea
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Post title"
        rows={1}
        required
        className="border-0 shadow-none focus-visible:ring-0 px-0 text-lg font-semibold leading-tight min-h-[32px] resize-none placeholder:text-gray-300"
      />

      {/* Property rows */}
      <div className="space-y-1">
        <PropertyRow
          icon={({ className }) => (
            <PostStatusIcon status={formData.status} size={14} className={className} />
          )}
          label="Status"
        >
          <PostStatusPicker
            value={formData.status}
            onChange={(v) => setFormData({ ...formData, status: v })}
          >
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-gray-700 hover:bg-gray-100">
              <PostStatusIcon status={formData.status} size={14} />
              {statusLabel}
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </span>
          </PostStatusPicker>
        </PropertyRow>

        <PropertyRow icon={CalendarIcon} label="Schedule">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100">
            <input
              type="date"
              value={formData.scheduled_date || ""}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="bg-transparent text-[13px] text-gray-700 outline-none"
              required
            />
            {formData.scheduled_date && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, scheduled_date: "" })}
                className="text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </PropertyRow>

        <PropertyRow icon={HashIcon} label="Platforms">
          <div className="flex flex-wrap items-center gap-1.5">
            {PLATFORMS.map((p) => {
              const active = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] border ${
                    active
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <PlatformChip platform={p.id} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </PropertyRow>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
            Content
          </span>
          {lowestLimit && (
            <span
              className={`text-xs tabular-nums ${
                contentLength > lowestLimit ? "text-red-500 font-medium" : "text-gray-400"
              }`}
            >
              {contentLength} / {lowestLimit}
            </span>
          )}
        </div>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={5}
          placeholder="Write your post content…"
          required
          className="text-sm"
        />
      </div>

      {/* Image */}
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3" />
          Image
        </div>
        {formData.image_url ? (
          <div className="relative rounded-lg overflow-hidden border bg-gray-50">
            <img
              src={formData.image_url}
              alt="Post"
              className="w-full max-h-48 object-cover"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
            <button
              type="button"
              onClick={() => setFormData({ ...formData, image_url: "" })}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
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
                  Drop an image here or <span className="text-indigo-600 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WebP up to 10MB</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) handleImageUpload(f);
              }}
            />
          </div>
        )}
      </div>

      {/* More options */}
      {!showAdvanced && (
        <button
          type="button"
          onClick={() => setShowAdvanced(true)}
          className="text-[12px] text-gray-500 hover:text-gray-700"
        >
          + More options
        </button>
      )}

      {showAdvanced && (
        <div className="space-y-1">
          <PropertyRow icon={HashIcon} label="Hashtags">
            <Input
              value={formData.hashtags || ""}
              onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
              placeholder="#marketing #growth"
              className="h-7 border-none shadow-none focus-visible:ring-0 px-1 text-sm"
            />
          </PropertyRow>
          <PropertyRow icon={LinkIcon} label="Link">
            <Input
              value={formData.link_url || ""}
              onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
              placeholder="https://…"
              className="h-7 border-none shadow-none focus-visible:ring-0 px-1 text-sm"
            />
          </PropertyRow>
          <PropertyRow icon={Building2} label="Account">
            <AccountPicker
              value={formData.client_id}
              accounts={accounts}
              onChange={(v) => setFormData({ ...formData, client_id: v })}
            />
          </PropertyRow>
          <PropertyRow icon={UserIcon} label="Assignee">
            <AssigneePicker
              value={formData.assigned_to || ""}
              teamMembers={teamMembers}
              onChange={(v) => setFormData({ ...formData, assigned_to: v })}
            />
          </PropertyRow>
          <PropertyRow icon={FileText} label="Notes">
            <Textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Internal notes"
              className="text-sm"
            />
          </PropertyRow>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-100">
        {isEdit ? (
          <>
            <span className="mr-auto text-[11px] text-gray-400 tabular-nums">
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "✓ All changes saved"}
              {saveState === "error" && (
                <span className="text-red-600">Save failed — changes may be lost</span>
              )}
            </span>
            <Button type="button" variant="outline" onClick={onCancel}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
              Create Post
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
