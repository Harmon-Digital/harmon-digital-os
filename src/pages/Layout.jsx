
import React from "react";
import LinearSidebar from "@/components/ui/LinearSidebar";
import QuickActions from "@/components/QuickActions";
import CommandPalette from "@/components/CommandPalette";

export default function Layout({ children }) {
  return (
    <>
      <LinearSidebar>{children}</LinearSidebar>
      <QuickActions />
      <CommandPalette />
    </>
  );
}
