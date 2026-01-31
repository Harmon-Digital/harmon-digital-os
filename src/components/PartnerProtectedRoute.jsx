import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function PartnerProtectedRoute({ children }) {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/partner/login" state={{ from: location }} replace />;
  }

  // Check if user is a partner
  if (userProfile && userProfile.role !== "partner") {
    return <Navigate to="/partner/login" state={{ error: "Access denied" }} replace />;
  }

  return children;
}
