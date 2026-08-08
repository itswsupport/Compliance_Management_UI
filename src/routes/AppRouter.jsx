import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';

// Map the last path segment to a human page name shown in the browser tab title.
const PAGE_TITLES = {
  'pending':       'Pending Compliance',
  'approved':      'Approved Compliance',
  'overdue':       'Overdue Compliance',
  'rejected':      'Rejected Compliance',
  'view':          'Compliance View',
  'assign':        'Assign Compliance',
  'act-type':      'Compliance Act Category',
  'act-sub-type':  'Compliance Act Subcategory',
  'login-access':  'Login Access',
  'login':         'Login',
  'access-denied': 'Access Denied',
};

/** Updates document.title to the current page name on every route change. */
function RouteTitle() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    let name;
    if (path.includes('/admin/')) {
      name = 'Admin Settings';
    } else {
      const seg = path.split('/').filter(Boolean).pop() || '';
      name = PAGE_TITLES[seg] || 'Compliance Portal';
    }
    document.title = name;
  }, [location.pathname]);
  return null;
}

// Auth pages
import LoginCheck   from '../pages/auth/LoginCheck';
import TokenLogin   from '../pages/auth/TokenLogin';
import AccessDenied from '../pages/auth/AccessDenied';

// Comp Admin
import CompAdminPending  from '../pages/compAdmin/PendingCompliance';
import CompAdminApproved from '../pages/compAdmin/ApprovedCompliance';
import CompAdminOverdue  from '../pages/compAdmin/OverdueCompliance';
import AssignCompliance  from '../pages/compAdmin/AssignCompliance';
import CompAdminView     from '../pages/compAdmin/ComplianceView';

// Plant HR
import PlantHrPending  from '../pages/plantHr/PendingCompliance';
import PlantHrApproved from '../pages/plantHr/ApprovedCompliance';
import PlantHrOverdue  from '../pages/plantHr/OverdueCompliance';
import PlantHrView     from '../pages/plantHr/ComplianceView';

// Comp Head
import CompHeadPending  from '../pages/compHead/PendingCompliance';
import CompHeadApproved from '../pages/compHead/ApprovedCompliance';
import CompHeadRejected from '../pages/compHead/RejectedCompliance';
import CompHeadView     from '../pages/compHead/ComplianceView';

// Corp HR
import CorpHrPending  from '../pages/corpHr/PendingCompliance';
import CorpHrApproved from '../pages/corpHr/ApprovedCompliance';
import CorpHrRejected from '../pages/corpHr/RejectedCompliance';
import CorpHrView     from '../pages/corpHr/ComplianceView';

// HCM Head
import HcmHeadPending  from '../pages/hcmHead/PendingCompliance';
import HcmHeadApproved from '../pages/hcmHead/ApprovedCompliance';
import HcmHeadRejected from '../pages/hcmHead/RejectedCompliance';
import HcmHeadView     from '../pages/hcmHead/ComplianceView';

// Authority
import AuthorityPending  from '../pages/authority/PendingCompliance';
import AuthorityApproved from '../pages/authority/ApprovedCompliance';
import AuthorityRejected from '../pages/authority/RejectedCompliance';
import AuthorityOverdue  from '../pages/authority/OverdueCompliance';
import AuthorityView     from '../pages/authority/ComplianceView';

// Admin Settings
import ActTypeMaster    from '../pages/adminSettings/ComplianceActTypeMaster';
import ActSubTypeMaster from '../pages/adminSettings/ComplianceActSubTypeMaster';
import LoginAccessMaster from '../pages/adminSettings/LoginAccessMaster';

/**
 * Protected route — redirects to /login if not authenticated
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <i className="fas fa-spinner fa-spin text-3xl text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function AppRouter() {

  return (
    <BrowserRouter basename="/compliance">
      <RouteTitle />
      <Routes>
        {/* Public */}
        <Route path="/login"         element={<LoginCheck />} />
        <Route path="/access-denied" element={<AccessDenied />} />

        {/* Comp Admin */}
        <Route path="/comp-admin/pending"  element={<ProtectedRoute><CompAdminPending /></ProtectedRoute>} />
        <Route path="/comp-admin/approved" element={<ProtectedRoute><CompAdminApproved /></ProtectedRoute>} />
        <Route path="/comp-admin/overdue"  element={<ProtectedRoute><CompAdminOverdue /></ProtectedRoute>} />
        <Route path="/comp-admin/assign"   element={<ProtectedRoute><AssignCompliance /></ProtectedRoute>} />
        <Route path="/comp-admin/view"     element={<ProtectedRoute><CompAdminView showAction={true} /></ProtectedRoute>} />

        {/* Plant HR */}
        <Route path="/plant-hr/pending"  element={<ProtectedRoute><PlantHrPending /></ProtectedRoute>} />
        <Route path="/plant-hr/approved" element={<ProtectedRoute><PlantHrApproved /></ProtectedRoute>} />
        <Route path="/plant-hr/overdue"  element={<ProtectedRoute><PlantHrOverdue /></ProtectedRoute>} />
        <Route path="/plant-hr/view"     element={<ProtectedRoute><PlantHrView /></ProtectedRoute>} />

        {/* Comp Head */}
        <Route path="/comp-head/pending"  element={<ProtectedRoute><CompHeadPending /></ProtectedRoute>} />
        <Route path="/comp-head/approved" element={<ProtectedRoute><CompHeadApproved /></ProtectedRoute>} />
        <Route path="/comp-head/rejected" element={<ProtectedRoute><CompHeadRejected /></ProtectedRoute>} />
        <Route path="/comp-head/view"     element={<ProtectedRoute><CompHeadView /></ProtectedRoute>} />

        {/* Corp HR */}
        <Route path="/corp-hr/pending"  element={<ProtectedRoute><CorpHrPending /></ProtectedRoute>} />
        <Route path="/corp-hr/approved" element={<ProtectedRoute><CorpHrApproved /></ProtectedRoute>} />
        <Route path="/corp-hr/rejected" element={<ProtectedRoute><CorpHrRejected /></ProtectedRoute>} />
        <Route path="/corp-hr/view"     element={<ProtectedRoute><CorpHrView /></ProtectedRoute>} />

        {/* HCM Head */}
        <Route path="/hcm-head/pending"  element={<ProtectedRoute><HcmHeadPending /></ProtectedRoute>} />
        <Route path="/hcm-head/approved" element={<ProtectedRoute><HcmHeadApproved /></ProtectedRoute>} />
        <Route path="/hcm-head/rejected" element={<ProtectedRoute><HcmHeadRejected /></ProtectedRoute>} />
        <Route path="/hcm-head/view"     element={<ProtectedRoute><HcmHeadView /></ProtectedRoute>} />

        {/* Authority */}
        <Route path="/authority/pending"  element={<ProtectedRoute><AuthorityPending /></ProtectedRoute>} />
        <Route path="/authority/approved" element={<ProtectedRoute><AuthorityApproved /></ProtectedRoute>} />
        <Route path="/authority/rejected" element={<ProtectedRoute><AuthorityRejected /></ProtectedRoute>} />
        <Route path="/authority/overdue"  element={<ProtectedRoute><AuthorityOverdue /></ProtectedRoute>} />
        <Route path="/authority/view"     element={<ProtectedRoute><AuthorityView /></ProtectedRoute>} />

        {/* Admin Settings */}
        <Route path="/admin/act-type"     element={<ProtectedRoute><ActTypeMaster /></ProtectedRoute>} />
        <Route path="/admin/act-sub-type" element={<ProtectedRoute><ActSubTypeMaster /></ProtectedRoute>} />
        <Route path="/admin/login-access" element={<ProtectedRoute><LoginAccessMaster /></ProtectedRoute>} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/*
          Portal hand-off: /compliance/<token>. Declared last, but static paths
          like /login outrank a dynamic segment in the router's own ranking, so
          it only ever catches URLs nothing else claimed. A single segment that
          is not token-shaped is bounced to /login by the component itself.
        */}
        <Route path="/:token" element={<TokenLogin />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
