import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function SocialPostForm({ socialPost, accounts, teamMembers, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(socialPost || {
    title: "",
    content: "",
    platforms: [],
    scheduled_date: "",
    status: "draft",
    image_url: "",
    client_id: "",
    assigned_to: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handlePlatformToggle = (platform) => {
    const currentPlatforms = formData.platforms || [];
    if (currentPlatforms.includes(platform)) {
      setFormData({
        ...formData,
        platforms: currentPlatforms.filter(p => p !== platform)
      });
    } else {
      setFormData({
        ...formData,
        platforms: [...currentPlatforms, platform]
      });
    }
  };

  const platforms = [
    { id: "linkedin", label: "LinkedIn", icon: "🔗" },
    { id: "twitter", label: "Twitter", icon: "🐦" },
    { id: "facebook", label: "Facebook", icon: "📘" },
    { id: "instagram", label: "Instagram", icon: "📷" }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="content">Content *</Label>
          <Textarea
            id="content"
            value={formData.content}
            onChange={(e) => setFormData({...formData, content: e.target.value})}
            rows={5}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Platforms *</Label>
          <div className="grid grid-cols-2 gap-3">
            {platforms.map(platform => (
              <div key={platform.id} className="flex items-center space-x-2">
                <Checkbox
                  id={platform.id}
                  checked={formData.platforms?.includes(platform.id)}
                  onCheckedChange={() => handlePlatformToggle(platform.id)}
                />
                <Label htmlFor={platform.id} className="cursor-pointer flex items-center gap-2">
                  <span>{platform.icon}</span>
                  <span>{platform.label}</span>
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="scheduled_date">Scheduled Date *</Label>
            <Input
              id="scheduled_date"
              type="date"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="image_url">Image URL</Label>
          <Input
            id="image_url"
            value={formData.image_url}
            onChange={(e) => setFormData({...formData, image_url: e.target.value})}
            placeholder="https://"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="client_id">Account (Optional)</Label>
            <Select value={formData.client_id} onValueChange={(value) => setFormData({...formData, client_id: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assigned To</Label>
            <Select value={formData.assigned_to} onValueChange={(value) => setFormData({...formData, assigned_to: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                  <SelectItem key={tm.id} value={tm.id}>
                    {tm.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
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