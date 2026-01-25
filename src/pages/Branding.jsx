import React, { useState, useEffect } from "react";
import { BrandingSettings } from "@/api/entities";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Image as ImageIcon, Palette, Type, Save, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        // Create default settings
        const defaultSettings = await BrandingSettings.create({
          logo_url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e5a112b53f4b50bdce1fda/08a68bdc6_Icon.png",
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
      const formData = new FormData();
      formData.append('file', file);

      const response = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = response.file_url;

      handleChange(field, fileUrl);
      setSuccessMessage(`${field.replace('_', ' ')} uploaded successfully!`);
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
      setSuccessMessage("Branding settings saved successfully!");
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
      <div className="p-6 lg:p-8">
        <div className="text-center py-12">
          <RefreshCw className="w-12 h-12 mx-auto text-gray-400 animate-spin mb-4" />
          <p className="text-gray-500">Loading branding settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Branding</h1>
          <p className="text-gray-500 mt-1">Manage your brand identity and assets</p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {successMessage && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Logos Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Logos & Images
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Logo */}
            <div className="space-y-2">
              <Label>Main Logo</Label>
              <div className="flex items-center gap-4">
                {settings?.logo_url && (
                  <div className="w-24 h-24 border rounded-lg flex items-center justify-center bg-gray-50">
                    <img 
                      src={settings.logo_url} 
                      alt="Logo" 
                      className="max-w-full max-h-full object-contain p-2"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('logo_url', file);
                    }}
                    disabled={uploading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recommended: Square format, 512x512px or larger
                  </p>
                </div>
              </div>
            </div>

            {/* Dark Mode Logo */}
            <div className="space-y-2">
              <Label>Dark Mode Logo (Optional)</Label>
              <div className="flex items-center gap-4">
                {settings?.logo_dark_url && (
                  <div className="w-24 h-24 border rounded-lg flex items-center justify-center bg-gray-900">
                    <img 
                      src={settings.logo_dark_url} 
                      alt="Dark Logo" 
                      className="max-w-full max-h-full object-contain p-2"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('logo_dark_url', file);
                    }}
                    disabled={uploading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Light-colored logo for dark backgrounds
                  </p>
                </div>
              </div>
            </div>

            {/* Favicon */}
            <div className="space-y-2">
              <Label>Favicon (Optional)</Label>
              <div className="flex items-center gap-4">
                {settings?.favicon_url && (
                  <div className="w-12 h-12 border rounded flex items-center justify-center bg-gray-50">
                    <img 
                      src={settings.favicon_url} 
                      alt="Favicon" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('favicon_url', file);
                    }}
                    disabled={uploading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Browser tab icon, 32x32px or 64x64px
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colors Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Brand Colors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings?.primary_color || "#4F46E5"}
                    onChange={(e) => handleChange("primary_color", e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    type="text"
                    value={settings?.primary_color || "#4F46E5"}
                    onChange={(e) => handleChange("primary_color", e.target.value)}
                    placeholder="#4F46E5"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings?.secondary_color || "#3B82F6"}
                    onChange={(e) => handleChange("secondary_color", e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    type="text"
                    value={settings?.secondary_color || "#3B82F6"}
                    onChange={(e) => handleChange("secondary_color", e.target.value)}
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings?.accent_color || "#10B981"}
                    onChange={(e) => handleChange("accent_color", e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    type="text"
                    value={settings?.accent_color || "#10B981"}
                    onChange={(e) => handleChange("accent_color", e.target.value)}
                    placeholder="#10B981"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Color Preview */}
            <div className="mt-6 p-4 border rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-3">Preview</p>
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <div 
                    className="h-16 rounded-lg"
                    style={{ backgroundColor: settings?.primary_color || "#4F46E5" }}
                  />
                  <p className="text-xs text-center text-gray-600">Primary</p>
                </div>
                <div className="flex-1 space-y-2">
                  <div 
                    className="h-16 rounded-lg"
                    style={{ backgroundColor: settings?.secondary_color || "#3B82F6" }}
                  />
                  <p className="text-xs text-center text-gray-600">Secondary</p>
                </div>
                <div className="flex-1 space-y-2">
                  <div 
                    className="h-16 rounded-lg"
                    style={{ backgroundColor: settings?.accent_color || "#10B981" }}
                  />
                  <p className="text-xs text-center text-gray-600">Accent</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Typography Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="w-5 h-5" />
              Typography
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Input
                value={settings?.font_family || "Inter"}
                onChange={(e) => handleChange("font_family", e.target.value)}
                placeholder="Inter, Arial, sans-serif"
              />
              <p className="text-xs text-gray-500">
                System fonts: Inter, Arial, Helvetica, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Custom Font File (Optional)</Label>
              <Input
                type="file"
                accept=".woff,.woff2,.ttf,.otf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload('font_url', file);
                }}
                disabled={uploading}
              />
              <p className="text-xs text-gray-500">
                Upload a custom font file (.woff, .woff2, .ttf, .otf)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Company Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={settings?.company_name || ""}
                onChange={(e) => handleChange("company_name", e.target.value)}
                placeholder="Harmon Digital"
              />
            </div>

            <div className="space-y-2">
              <Label>Tagline</Label>
              <Input
                value={settings?.tagline || ""}
                onChange={(e) => handleChange("tagline", e.target.value)}
                placeholder="Your company tagline"
              />
            </div>

            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={settings?.website || ""}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="https://yourcompany.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Branding Notes & Guidelines</Label>
              <Textarea
                value={settings?.notes || ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Add any branding guidelines, usage notes, or other important information..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
}