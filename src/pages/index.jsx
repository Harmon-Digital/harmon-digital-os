import Layout from "./Layout.jsx";

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

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Clients: Clients,
    
    Projects: Projects,
    
    TimeTracking: TimeTracking,
    
    CRM: CRM,
    
    SocialMedia: SocialMedia,
    
    Home: Home,
    
    Tasks: Tasks,
    
    Team: Team,
    
    Reports: Reports,
    
    Accounting: Accounting,
    
    Accounts: Accounts,
    
    Contacts: Contacts,
    
    ProjectDetail: ProjectDetail,
    
    StripeSync: StripeSync,
    
    Branding: Branding,
    
    AdminDashboard: AdminDashboard,
    
    AccountingDashboard: AccountingDashboard,
    
    SOPs: SOPs,
    
}

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

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Clients" element={<Clients />} />
                
                <Route path="/Projects" element={<Projects />} />
                
                <Route path="/TimeTracking" element={<TimeTracking />} />
                
                <Route path="/CRM" element={<CRM />} />
                
                <Route path="/SocialMedia" element={<SocialMedia />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/Tasks" element={<Tasks />} />
                
                <Route path="/Team" element={<Team />} />
                
                <Route path="/Reports" element={<Reports />} />
                
                <Route path="/Accounting" element={<Accounting />} />
                
                <Route path="/Accounts" element={<Accounts />} />
                
                <Route path="/Contacts" element={<Contacts />} />
                
                <Route path="/ProjectDetail" element={<ProjectDetail />} />
                
                <Route path="/StripeSync" element={<StripeSync />} />
                
                <Route path="/Branding" element={<Branding />} />
                
                <Route path="/AdminDashboard" element={<AdminDashboard />} />
                
                <Route path="/AccountingDashboard" element={<AccountingDashboard />} />
                
                <Route path="/SOPs" element={<SOPs />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}