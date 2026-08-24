import { useAuth } from '../../context/AuthContext';
import { PORTAL_URL } from '../../utils/constants';
import NotificationBell from './NotificationBell';
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
      window.location.href = PORTAL_URL;
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

      {/* Right: notifications + help + logout */}
      <div className="flex items-center gap-1 pr-6">
        <NotificationBell />

        {/* Help: opens the web user manual directly, no dropdown.
            The web manual replaces the old PDF deck: its screens are rebuilt
            from this app's own markup, so it cannot fall behind the UI the
            way the PDF's screenshots did. It carries its own Print / Save as
            PDF button for anyone who wants a paper copy. */}
        <a
          href={`${import.meta.env.BASE_URL}links/user_manual/index.html`}
          target="_blank"
          rel="noreferrer"
          className="text-white hover:text-white/80 text-xs transition-colors flex items-center gap-1.5 bg-transparent border-0 px-2 py-1 cursor-pointer uppercase select-none no-underline"
        >
          <i className="fas fa-comments text-sm" />
          <span>Help</span>
        </a>

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
