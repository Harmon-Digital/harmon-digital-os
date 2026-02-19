import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import PartnerProtectedRoute from '@/components/PartnerProtectedRoute';
import Layout from "./Layout.jsx";
import PartnerLayout from "@/components/layout/PartnerLayout";

// Auth pages
import Login from "./Login";
import ResetPassword from "./ResetPassword";

// App pages
import Dashboard from "./Dashboard";
import Clients from "./Clients";
import Projects from "./Projects";
import TimeTracking from "./TimeTracking";
import CRM from "./CRM";
import SocialMedia from "./SocialMedia";
import Home from "./Home";
import Tasks from "./Tasks";
import Team from "./Team";
import Reports from "./Reports";
import Accounting from "./Accounting";
import Accounts from "./Accounts";
import Contacts from "./Contacts";
import ProjectDetail from "./ProjectDetail";
import StripeSync from "./StripeSync";
import Branding from "./Branding";
import AdminDashboard from "./AdminDashboard";
import AccountingDashboard from "./AccountingDashboard";
import SOPs from "./SOPs";
import PersonalSettings from "./PersonalSettings";
import BrokerOutreach from "./BrokerOutreach";
import Partners from "./Partners";
import ReferralPayouts from "./ReferralPayouts";
import KPIs from "./KPIs";
import BotChannel from "./BotChannel";
import McpApiKeys from "./McpApiKeys";

// Partner portal pages
import PartnerLogin from "./partner/PartnerLogin";
import PartnerDashboard from "./partner/PartnerDashboard";
import PartnerSubmitReferral from "./partner/PartnerSubmitReferral";
import PartnerReferrals from "./partner/PartnerReferrals";
import PartnerPayouts from "./partner/PartnerPayouts";
import PartnerSettings from "./partner/PartnerSettings";

const PAGES = {
  Dashboard,
  Clients,
  Projects,
  TimeTracking,
  CRM,
  SocialMedia,
  Home,
  Tasks,
  Team,
  Reports,
  Accounting,
  Accounts,
  Contacts,
  ProjectDetail,
  StripeSync,
  Branding,
  AdminDashboard,
  AccountingDashboard,
  SOPs,
  PersonalSettings,
  BrokerOutreach,
  Partners,
  ReferralPayouts,
  KPIs,
  BotChannel,
  McpApiKeys,
};

function _getCurrentPage(url) {
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  let urlLastPart = url.split('/').pop();
  if (urlLastPart.includes('?')) {
    urlLastPart = urlLastPart.split('?')[0];
  }

  const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
  return pageName || Object.keys(PAGES)[0];
}

function PagesContent() {
  const location = useLocation();
  const currentPage = _getCurrentPage(location.pathname);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Dashboard" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Clients" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Clients />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Projects" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Projects />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/TimeTracking" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <TimeTracking />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/CRM" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <CRM />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/SocialMedia" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <SocialMedia />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Home" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Home />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Tasks" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Tasks />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Team" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Team />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Reports" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Reports />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Accounting" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Accounting />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Accounts" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Accounts />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Contacts" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Contacts />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/ProjectDetail" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <ProjectDetail />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/StripeSync" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <StripeSync />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Branding" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Branding />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/AdminDashboard" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <AdminDashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/AccountingDashboard" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <AccountingDashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/SOPs" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <SOPs />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/PersonalSettings" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <PersonalSettings />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/BrokerOutreach" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <BrokerOutreach />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/Partners" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <Partners />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/ReferralPayouts" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <ReferralPayouts />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/KPIs" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <KPIs />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/BotChannel" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <BotChannel />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/McpApiKeys" element={
        <ProtectedRoute>
          <Layout currentPageName={currentPage}>
            <McpApiKeys />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Partner Portal Routes */}
      <Route path="/partner/login" element={<PartnerLogin />} />

      <Route path="/partner" element={
        <PartnerProtectedRoute>
          <PartnerLayout>
            <PartnerDashboard />
          </PartnerLayout>
        </PartnerProtectedRoute>
      } />

      <Route path="/partner/submit" element={
        <PartnerProtectedRoute>
          <PartnerLayout>
            <PartnerSubmitReferral />
          </PartnerLayout>
        </PartnerProtectedRoute>
      } />

      <Route path="/partner/referrals" element={
        <PartnerProtectedRoute>
          <PartnerLayout>
            <PartnerReferrals />
          </PartnerLayout>
        </PartnerProtectedRoute>
      } />

      <Route path="/partner/payouts" element={
        <PartnerProtectedRoute>
          <PartnerLayout>
            <PartnerPayouts />
          </PartnerLayout>
        </PartnerProtectedRoute>
      } />

      <Route path="/partner/settings" element={
        <PartnerProtectedRoute>
          <PartnerLayout>
            <PartnerSettings />
          </PartnerLayout>
        </PartnerProtectedRoute>
      } />
    </Routes>
  );
}

export default function Pages() {
  return (
    <Router>
      <AuthProvider>
        <PagesContent />
      </AuthProvider>
    </Router>
  );
}
