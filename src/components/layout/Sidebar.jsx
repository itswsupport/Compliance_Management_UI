import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PORTAL_URL } from '../../utils/constants';
import { sectionOf } from '../../utils/navSection';
import Swal from 'sweetalert2';

// `label` is either a string or, where two roles share one entry, a function of
// the user — the link has to name the role the user actually holds.
const NAV_ITEMS = [
  {
    id: 'comp_admin',
    label: 'Comp Admin Dashboard',
    icon: 'fas fa-tachometer-alt',
    // Overdue, matching where login lands (utils/roleRoutes) — it is the page
    // that leads with the Compliance Calendar.
    to: '/comp-admin/overdue',
    show: (u) => u.isCompAdmin,
  },
  {
    id: 'plant_hr',
    // CHD and Plant HR share this entry — it names the role the user holds.
    label: (u) => (u.isChd ? 'CHD Dashboard' : 'Plant Hr Dashboard'),
    icon: 'fas fa-tachometer-alt',
    to: '/plant-hr/pending',
    show: (u) => u.isChd || u.isPlantHr,
  },
  {
    id: 'comp_head',
    label: 'Comp Head Dashboard',
    icon: 'fas fa-tachometer-alt',
    to: '/comp-head/pending',
    show: (u) => u.isCompHead,
  },
  {
    id: 'corp_hr',
    label: 'Corp HR Dashboard',
    icon: 'fas fa-tachometer-alt',
    to: '/corp-hr/pending',
    show: (u) => u.isCorpHr,
  },
  {
    id: 'hcm_head',
    label: 'HCM Head Dashboard',
    icon: 'fas fa-tachometer-alt',
    to: '/hcm-head/pending',
    show: (u) => u.isHcmHead,
  },
  {
    id: 'authority',
    label: 'Authority Dashboard',
    icon: 'fas fa-tachometer-alt',
    to: '/authority/pending',
    show: (u) => u.isAuthority,
  },
  // No notice entry here. Every dashboard carries a Notice Dashboard card, and
  // that card is the way in — a sidebar link beside it would be a second door
  // to the same room. See NAV_CARDS on the dashboard pages.
  {
    id: 'legal_notice',
    // Plant HR and Comp Admin only. For them legal notices are a place of work
    // with tabs of their own — raise one, submit it, approve it — so it earns a
    // sidebar entry the way a dashboard does, and it deliberately has NO card on
    // their compliance row: one door, not two, the same rule the notice entry
    // above is absent for. Every other role reads legal notices instead, and
    // reaches them by the Legal Notice card on their dashboard (see navCards).
    label: 'Legal Notice',
    icon: 'fas fa-gavel',
    to: '/legal-notice/list',
    // Not the CHD, though they share the Plant HR's dashboard: a CHD only reads
    // legal notices, so they reach them by the Legal Notice card on that
    // dashboard, the way HCM Head and Authority do. The sidebar entry is for the
    // two roles that work here.
    show: (u) => u.isPlantHr || u.isCompAdmin,
  },
  {
    id: 'admin_settings',
    label: 'Admin Settings',
    icon: 'fas fa-wrench',
    to: '/admin',
    show: (u) => u.isCompAdmin,
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logoutUser } = useAuth();
  const { pathname } = useLocation();

  /**
   * Which entry is highlighted: the one whose SECTION the user is in, not the
   * one whose exact path they are on.
   *
   * Every dashboard entry points at a single landing tab — Plant HR at
   * /plant-hr/pending — so NavLink's own matching lit it up on that one tab and
   * nowhere else. /plant-hr/approved highlighted nothing at all, and
   * /plant-hr/legal-notice highlighted LEGAL NOTICE, which is a different
   * dashboard's entry: the user had not left the Plant HR dashboard, only opened
   * a card on it.
   *
   * By section, all three keep PLANT HR DASHBOARD lit, and the LEGAL NOTICE
   * entry lights only for its own /legal-notice workspace.
   */
  const here = sectionOf(pathname);

  async function handleLogout() {
    const result = await Swal.fire({
      title: 'Logout?',
      text: 'Are you sure you want to logout?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3482AE',
      cancelButtonColor: '#df4759',
      confirmButtonText: 'Yes, Logout',
    });
    if (result.isConfirmed) {
      await logoutUser();
      window.location.href = PORTAL_URL;
    }
  }

  const authorityLabel = user?.isAuthority
    ? user?.designation
    : user?.authority;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed top-11 inset-x-0 bottom-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-11 lg:top-0 left-0 h-[calc(100vh-44px)] lg:h-full z-50 flex flex-col transition-all duration-300 ease-in-out shadow-2xl
          ${isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'}`}
        style={{ backgroundColor: '#3482AE'}}
      >
        {/* Brand Link (Always at top) */}
        {isOpen && (
          <div className="h-11 flex items-center px-4 border-b border-white/80 gap-2 flex-shrink-0 overflow-hidden">
            {/* BASE_URL, not a leading slash: the app is served under vite.config.js's
                `base`, so "/RUCHA-LOGO-WHITE.png" resolves at the server root and 404s.
                Vite rewrites imported assets and index.html URLs, but not absolute URL
                strings written in JSX — this has to carry the base itself. */}
            <img src={`${import.meta.env.BASE_URL}RUCHA-LOGO-WHITE.png`} alt="Rucha Logo" className="flex-shrink-0" style={{ height: '24px', opacity: 0.9 }} />
            <span className="text-white text-[12px] uppercase tracking-wider whitespace-nowrap">
              Compliance Management
            </span>
          </div> 
        )}

        {/* User panel */}
        {isOpen && (
          <div className="px-4 py-2.5 border-b border-white/80 flex-shrink-0 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded p-0.5 shadow-sm overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ width: '50px', height: '50px' }}>
                <img src={`${import.meta.env.BASE_URL}yogesh.png`} alt="User Profile" className="w-full h-full object-cover rounded-sm" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-[12px] uppercase truncate tracking-wide leading-snug font-normal">
                  {user?.empName}
                </p>
                <p className="text-white/90 text-[12px] uppercase truncate tracking-wider mt-0.5 font-normal">
                  [{authorityLabel}]
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-1">
          {/* Home — links to the main RUCHA portal home page (external) */}
          <a
            href={PORTAL_URL}
            className={`sidebar-link flex items-center transition-all duration-300 ${isOpen ? 'gap-3 px-4' : '!justify-center !px-0'}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
              <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            {isOpen && <span className="whitespace-nowrap">Home</span>}
          </a>
          {NAV_ITEMS.filter((item) => user && item.show(user)).map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              onClick={() => { if (window.innerWidth < 1024) onClose(); }}
              className={() =>
                `sidebar-link flex items-center transition-all duration-300 ${isOpen ? 'gap-3 px-4' : '!justify-center !px-0'} ${here === sectionOf(item.to) ? 'active' : ''}`
              }
            >
              <i className={`${item.icon} w-4 text-center flex-shrink-0 text-sm`} />
              {isOpen && (
                <span className="whitespace-nowrap">
                  {typeof item.label === 'function' ? item.label(user) : item.label}
                </span>
              )}
            </NavLink>
          ))}
          {/* Logout as inline menu item */}
          <button
            onClick={handleLogout}
            className={`sidebar-link w-full text-left flex items-center transition-all duration-300 ${isOpen ? 'gap-3 px-4' : '!justify-center !px-0'} py-2`}
          >
            <i className="fas fa-sign-out-alt w-5 text-center flex-shrink-0 text-sm" />
            {isOpen && <span>Logout</span>}
          </button>
        </nav>
      </aside>
    </>
  );
}
