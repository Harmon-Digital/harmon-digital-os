import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ClientProtectedRoute({ children }) {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/client/login" state={{ from: location }} replace />;
  }

  if (!userProfile || userProfile.role !== "client") {
    return <Navigate to="/client/login" state={{ error: "Access denied" }} replace />;
  }

  return children;
}
