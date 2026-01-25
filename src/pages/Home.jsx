import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to AgencyHub</h1>
      <p className="text-gray-600 mb-8">Your internal agency management platform</p>
      
      <Link 
        to={createPageUrl("Dashboard")} 
        className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}