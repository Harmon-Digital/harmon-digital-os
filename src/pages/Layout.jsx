
import React from "react";
import ModernSidebar from "./components/ui/sidebar-component";
import QuickActions from "./components/QuickActions";

export default function Layout({ children }) {
  return (
    <>
      <ModernSidebar>{children}</ModernSidebar>
      <QuickActions />
    </>
  );
}
