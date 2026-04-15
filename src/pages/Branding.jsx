import React, { useState, useEffect } from "react";
import { BrandingSettings } from "@/api/entities";
import { api } from "@/api/legacyClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Save, RefreshCw } from "lucide-react";

export default function Branding() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await BrandingSettings.list();
      if (data.length > 0) {
        setSettings(data[0]);
      } else {
        const defaultSettings = await BrandingSettings.create({
          logo_url: "",
          primary_color: "#4F46E5",
          secondary_color: "#3B82F6",
          accent_color: "#10B981",
          font_family: "Inter",
          company_name: "Harmon Digital",
        });
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleFileUpload = async (field, file) => {
    setUploading(true);
    try {
      const response = await api.integrations.Core.UploadFile({ file });
      const fileUrl = response.file_url;

      handleChange(field, fileUrl);
      setSuccessMessage(`${field.replace('_', ' ')} uploaded successfully.`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await BrandingSettings.update(settings.id, settings);
      setSuccessMessage("Branding settings saved successfully.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <div className="border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 px-4 h-12">
            <h1 className="text-[15px] font-semibold text-gray-900">Branding</h1>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mb-3" />
          <p className="text-sm text-gray-500">Loading branding settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden settings-form">
      <style>{`
        .settings-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]),
        .settings-form textarea,
        .settings-form [role="combobox"] {
          border-color: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          transition: background-color 0.12s ease, border-color 0.12s ease;
        }
        .settings-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):hover,
        .settings-form textarea:hover,
        .settings-form [role="combobox"]:hover {
          background-color: rgb(249 250 251) !important;
        }
        .settings-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):focus,
        .settings-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):focus-visible,
        .settings-form textarea:focus,
        .settings-form textarea:focus-visible,
        .settings-form [role="combobox"]:focus,
        .settings-form [role="combobox"][data-state="open"] {
          background-color: white !important;
          border-color: rgb(199 210 254) !important;
          box-shadow: 0 0 0 3px rgb(224 231 255 / 0.45) !important;
          outline: none !important;
        }
      `}</style>

      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-4 h-12">
          <h1 className="text-[15px] font-semibold text-gray-900">Branding</h1>
          <div className="ml-auto">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0">
        <div className="px-4 lg:px-6 py-4 max-w-4xl">
          {successMessage && (
            <div className="mb-4 px-3 py-2 rounded text-[13px] bg-green-50 text-green-800 border border-green-200">
              {successMessage}
            </div>
          )}

          <Tabs defaultValue="identity" className="space-y-5">
            <TabsList className="h-9 bg-transparent p-0 border-b border-gray-200 rounded-none w-full justify-start gap-5 px-1">
              <TabsTrigger
                value="identity"
                className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900"
              >
                Identity
              </TabsTrigger>
              <TabsTrigger
                value="logos"
                className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900"
              >
                Logos
              </TabsTrigger>
              <TabsTrigger
                value="colors"
                className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900"
              >
                Colors
              </TabsTrigger>
              <TabsTrigger
                value="typography"
                className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900"
              >
                Typography
              </TabsTrigger>
            </TabsList>

            {/* Identity Tab */}
            <TabsContent value="identity" className="space-y-4">
              <div>
                <div className="h-7 flex items-center">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Company</span>
                </div>
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Company name</label>
                    <Input
                      value={settings?.company_name || ""}
                      onChange={(e) => handleChange("company_name", e.target.value)}
                      placeholder="Harmon Digital"
                      className="flex-1 h-8 text-[13px]"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Tagline</label>
                    <Input
                      value={settings?.tagline || ""}
                      onChange={(e) => handleChange("tagline", e.target.value)}
                      placeholder="Your company tagline"
                      className="flex-1 h-8 text-[13px]"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Website</label>
                    <Input
                      value={settings?.website || ""}
                      onChange={(e) => handleChange("website", e.target.value)}
                      placeholder="https://yourcompany.com"
                      className="flex-1 h-8 text-[13px]"
                    />
                  </div>
                  <div className="flex items-start gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0 mt-2">Notes</label>
                    <Textarea
                      value={settings?.notes || ""}
                      onChange={(e) => handleChange("notes", e.target.value)}
                      placeholder="Branding guidelines, usage notes, or other important information…"
                      rows={4}
                      className="flex-1 text-[13px]"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Logos Tab */}
            <TabsContent value="logos" className="space-y-4">
              <div>
                <div className="h-7 flex items-center">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Logos & icons</span>
                </div>
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  <LogoRow
                    label="Main logo"
                    hint="Square format, 512×512px or larger"
                    src={settings?.logo_url}
                    bgClass="bg-gray-50"
                    onFile={(file) => handleFileUpload('logo_url', file)}
                    uploading={uploading}
                    size="lg"
                  />
                  <LogoRow
                    label="Dark logo"
                    hint="Light-colored logo for dark backgrounds"
                    src={settings?.logo_dark_url}
                    bgClass="bg-gray-900"
                    onFile={(file) => handleFileUpload('logo_dark_url', file)}
                    uploading={uploading}
                    size="lg"
                  />
                  <LogoRow
                    label="Favicon"
                    hint="Browser tab icon, 32×32px or 64×64px"
                    src={settings?.favicon_url}
                    bgClass="bg-gray-50"
                    onFile={(file) => handleFileUpload('favicon_url', file)}
                    uploading={uploading}
                    size="sm"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Colors Tab */}
            <TabsContent value="colors" className="space-y-4">
              <div>
                <div className="h-7 flex items-center">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Brand colors</span>
                </div>
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  <ColorRow
                    label="Primary"
                    value={settings?.primary_color || "#4F46E5"}
                    onChange={(v) => handleChange("primary_color", v)}
                  />
                  <ColorRow
                    label="Secondary"
                    value={settings?.secondary_color || "#3B82F6"}
                    onChange={(v) => handleChange("secondary_color", v)}
                  />
                  <ColorRow
                    label="Accent"
                    value={settings?.accent_color || "#10B981"}
                    onChange={(v) => handleChange("accent_color", v)}
                  />
                </div>
              </div>

              <div>
                <div className="h-7 flex items-center">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Preview</span>
                </div>
                <div className="pt-3 flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div
                      className="h-12 rounded-md"
                      style={{ backgroundColor: settings?.primary_color || "#4F46E5" }}
                    />
                    <p className="text-[11px] text-gray-500 text-center">Primary</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div
                      className="h-12 rounded-md"
                      style={{ backgroundColor: settings?.secondary_color || "#3B82F6" }}
                    />
                    <p className="text-[11px] text-gray-500 text-center">Secondary</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div
                      className="h-12 rounded-md"
                      style={{ backgroundColor: settings?.accent_color || "#10B981" }}
                    />
                    <p className="text-[11px] text-gray-500 text-center">Accent</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography" className="space-y-4">
              <div>
                <div className="h-7 flex items-center">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Typography</span>
                </div>
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Font family</label>
                    <Input
                      value={settings?.font_family || "Inter"}
                      onChange={(e) => handleChange("font_family", e.target.value)}
                      placeholder="Inter, Arial, sans-serif"
                      className="flex-1 h-8 text-[13px]"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Custom font</label>
                    <div className="flex-1 flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-2 h-7 rounded border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-[13px] text-gray-700">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploading ? "Uploading…" : "Upload font"}</span>
                        <input
                          type="file"
                          accept=".woff,.woff2,.ttf,.otf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload('font_url', file);
                          }}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>
                      {settings?.font_url && (
                        <span className="text-[11px] text-gray-500 truncate">Custom font uploaded</span>
                      )}
                      <span className="text-[11px] text-gray-400 ml-auto">.woff, .woff2, .ttf, .otf</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function LogoRow({ label, hint, src, bgClass, onFile, uploading, size = "lg" }) {
  const dim = size === "sm" ? "w-10 h-10" : "w-16 h-16";
  return (
    <div className="flex items-center gap-3 py-3">
      <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">{label}</label>
      <div className={`${dim} rounded border border-gray-200 ${bgClass} flex items-center justify-center shrink-0 overflow-hidden`}>
        {src ? (
          <img
            src={src}
            alt={label}
            className="max-w-full max-h-full object-contain p-1"
          />
        ) : (
          <span className="text-[10px] text-gray-400">No image</span>
        )}
      </div>
      <div className="flex-1 flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 px-2 h-7 rounded border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-[13px] text-gray-700">
          <Upload className="w-3.5 h-3.5" />
          <span>{uploading ? "Uploading…" : "Upload"}</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
            disabled={uploading}
            className="hidden"
          />
        </label>
        <span className="text-[11px] text-gray-500 ml-auto">{hint}</span>
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-200 p-0.5 cursor-pointer bg-transparent"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="w-32 h-8 text-[13px] font-mono"
        />
        <div
          className="h-8 flex-1 rounded border border-gray-200"
          style={{ backgroundColor: value }}
        />
      </div>
    </div>
  );
}
