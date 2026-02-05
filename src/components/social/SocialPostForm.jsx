import React, { useState, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, Image as ImageIcon, Link, Hash, Loader2 } from "lucide-react";

const PLATFORM_LIMITS = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
};

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", icon: "🔗" },
  { id: "twitter", label: "Twitter", icon: "🐦" },
  { id: "facebook", label: "Facebook", icon: "📘" },
  { id: "instagram", label: "Instagram", icon: "📷" },
];

export default function SocialPostForm({ socialPost, accounts, teamMembers, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(socialPost || {
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
  });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanedData = {
      ...formData,
      client_id: formData.client_id || null,
      assigned_to: formData.assigned_to || null,
      image_url: formData.image_url || null,
      hashtags: formData.hashtags || null,
      link_url: formData.link_url || null,
      notes: formData.notes || null,
    };
    onSubmit(cleanedData);
  };

  const handlePlatformToggle = (platform) => {
    const current = formData.platforms || [];
    setFormData({
      ...formData,
      platforms: current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform],
    });
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `social/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("uploads")
        .getPublicUrl(fileName);

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) handleImageUpload(file);
  };

  // Character count for smallest selected platform
  const contentLength = (formData.content || "").length;
  const selectedPlatforms = formData.platforms || [];
  const lowestLimit = selectedPlatforms.length > 0
    ? Math.min(...selectedPlatforms.map((p) => PLATFORM_LIMITS[p] || 99999))
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Post title for internal tracking"
          required
        />
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="content">Content *</Label>
          {lowestLimit && (
            <span className={`text-xs tabular-nums ${
              contentLength > lowestLimit ? "text-red-500 font-medium" : "text-gray-400"
            }`}>
              {contentLength} / {lowestLimit}
            </span>
          )}
        </div>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={5}
          placeholder="Write your post content..."
          required
        />
      </div>

      {/* Hashtags */}
      <div className="space-y-1.5">
        <Label htmlFor="hashtags" className="flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5 text-gray-400" />
          Hashtags
        </Label>
        <Input
          id="hashtags"
          value={formData.hashtags || ""}
          onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
          placeholder="#marketing #digitalagency #growth"
        />
      </div>

      {/* Image Upload */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
          Image
        </Label>

        {formData.image_url ? (
          <div className="relative rounded-lg overflow-hidden border bg-gray-50">
            <img
              src={formData.image_url}
              alt="Post image"
              className="w-full max-h-48 object-cover"
              onError={(e) => { e.target.style.display = "none"; }}
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
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 mx-auto text-indigo-500 animate-spin" />
            ) : (
              <>
                <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">
                  Drop an image here or <span className="text-indigo-600 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP up to 10MB</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}
      </div>

      {/* Link URL */}
      <div className="space-y-1.5">
        <Label htmlFor="link_url" className="flex items-center gap-1.5">
          <Link className="w-3.5 h-3.5 text-gray-400" />
          Link URL
        </Label>
        <Input
          id="link_url"
          value={formData.link_url || ""}
          onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
          placeholder="https://yoursite.com/page"
        />
      </div>

      {/* Platforms */}
      <div className="space-y-1.5">
        <Label>Platforms *</Label>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((platform) => (
            <label
              key={platform.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                formData.platforms?.includes(platform.id)
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Checkbox
                id={platform.id}
                checked={formData.platforms?.includes(platform.id)}
                onCheckedChange={() => handlePlatformToggle(platform.id)}
              />
              <span className="text-sm">{platform.icon} {platform.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date / Status / Assigned To */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="scheduled_date">Date *</Label>
          <Input
            id="scheduled_date"
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assigned_to">Assigned To</Label>
          <Select value={formData.assigned_to || "none"} onValueChange={(v) => setFormData({ ...formData, assigned_to: v === "none" ? "" : v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {teamMembers.filter((tm) => tm.status === "active").map((tm) => (
                <SelectItem key={tm.id} value={tm.id}>
                  {tm.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Account */}
      <div className="space-y-1.5">
        <Label htmlFor="client_id">Account (Optional)</Label>
        <Select value={formData.client_id || "none"} onValueChange={(v) => setFormData({ ...formData, client_id: v === "none" ? "" : v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Internal Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Internal Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          placeholder="Notes for your team (not published)"
          className="text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {socialPost ? "Update" : "Create"} Post
        </Button>
      </div>
    </form>
  );
}
