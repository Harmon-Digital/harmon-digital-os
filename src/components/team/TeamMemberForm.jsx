import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TeamMemberForm({ teamMember, users, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(teamMember || {
    user_id: "",
    full_name: "",
    email: "",
    bio: "",
    role: "developer",
    employment_type: "full_time",
    hourly_rate: 0,
    skills: [],
    status: "active",
    profile_image_url: ""
  });

  const [skillInput, setSkillInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleUserSelect = (userId) => {
    const selectedUser = users.find(u => u.id === userId);
    if (selectedUser) {
      setFormData({
        ...formData,
        user_id: userId,
        full_name: selectedUser.full_name,
        email: selectedUser.email
      });
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()]
      });
      setSkillInput("");
    }
  };

  const removeSkill = (skill) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(s => s !== skill)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {!teamMember && (
          <div className="space-y-2">
            <Label htmlFor="user_id">Link to User (Optional)</Label>
            <Select value={formData.user_id} onValueChange={handleUserSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select user account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No user account</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={formData.bio || ""}
            onChange={(e) => setFormData({...formData, bio: e.target.value})}
            placeholder="Tell us about this team member..."
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role *</Label>
          <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="developer">Developer</SelectItem>
              <SelectItem value="designer">Designer</SelectItem>
              <SelectItem value="project_manager">Project Manager</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile_image_url">Profile Image URL</Label>
          <Input
            id="profile_image_url"
            type="url"
            value={formData.profile_image_url || ""}
            onChange={(e) => setFormData({...formData, profile_image_url: e.target.value})}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="space-y-2">
          <Label>Skills</Label>
          <div className="flex gap-2">
            <Input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              placeholder="Add a skill..."
            />
            <Button type="button" onClick={addSkill} variant="outline">
              Add
            </Button>
          </div>
          {formData.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.skills.map(skill => (
                <div key={skill} className="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="employment_type">Employment Type</Label>
            <Select value={formData.employment_type} onValueChange={(value) => setFormData({...formData, employment_type: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hourly_rate">Hourly Rate (for internal tracking)</Label>
          <Input
            id="hourly_rate"
            type="number"
            step="0.01"
            value={formData.hourly_rate}
            onChange={(e) => setFormData({...formData, hourly_rate: parseFloat(e.target.value) || 0})}
          />
          <p className="text-xs text-gray-500">Used for cost calculations in reports (not visible to non-admin users)</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {teamMember ? "Update" : "Create"} Team Member
        </Button>
      </div>
    </form>
  );
}