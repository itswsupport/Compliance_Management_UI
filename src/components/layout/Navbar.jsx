import { useAuth } from '../../context/AuthContext';
import { PORTAL_URL } from '../../utils/constants';
import Swal from 'sweetalert2';

export default function Navbar({ onMenuToggle, sidebarOpen }) {
  const { logoutUser } = useAuth();

  async function handleLogout() {
    const result = await Swal.fire({
      title: 'Logout?',
      text: 'Are you sure you want to logout?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3482AE',
      cancelButtonColor: '#df4759',
      confirmButtonText: 'Yes, Logout',
      width: '300px',
    });
    if (result.isConfirmed) {
      await logoutUser();
      window.location.href = 'https://replportal.co.in:8443/portal/dashboard.jsp';
    }
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-30 h-11 flex items-center justify-between px-0 border-b border-white/30 transition-all duration-300 ${sidebarOpen ? 'lg:left-64' : 'lg:left-0'}`}
      style={{ backgroundColor: '#3482AE' }}>
      {/* Left: hamburger */}
      <div className="flex items-center gap-3 pl-3.5">
        <button
          onClick={onMenuToggle}
          className="text-white hover:text-white/80 transition-colors p-1 bg-transparent border-0 cursor-pointer outline-none focus:outline-none focus:ring-0"
          aria-label="Toggle sidebar"
        >
          <i className="fa fa-bars text-xs" />
        </button>
      </div>

      {/* Center: empty */}
      <div className="flex items-center gap-1" />

      {/* Right: help + logout */}
      <div className="flex items-center gap-3">
        {/* Help dropdown */}
        <div className="relative group">
          <button className="text-white hover:text-white/80 text-xs  transition-colors flex items-center gap-1.5 bg-transparent border-0 px-2 py-1 cursor-pointer uppercase select-none">
            <i className="fas fa-comments text-sm" />
            <span>Help</span>
            <i className="fas fa-caret-down text-[10px]" />
          </button>
          <div className="absolute right-0 top-full mt-1 bg-white rounded shadow-lg border border-gray-200 py-1 w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
            <a
              href="/links/user_manual/ComplianceManagementSystemManual.pdf"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors normal-case"
            >
              <i className="fas fa-file-pdf text-red-500" /> User Manual
            </a>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="text-white hover:text-white/80 text-xs  transition-colors flex items-center gap-1.5 bg-transparent border-0 px-2 py-1 cursor-pointer uppercase select-none"
        >
          <i className="fas fa-sign-out-alt text-sm" />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
