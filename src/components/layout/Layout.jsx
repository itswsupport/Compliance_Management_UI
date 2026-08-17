import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useIdleLogout } from '../../hooks/useIdleLogout';
import { recordSection } from '../../utils/navSection';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const { pathname } = useLocation();

  // Signs out after 30 minutes of inactivity.
  useIdleLogout();

  // Every route reports which dashboard it belongs to, so returning to the
  // Comp Admin dashboard from Admin Settings — or from anywhere else that is
  // not a compliance list — counts as an arrival and leads with the calendar.
  useEffect(() => { recordSection(pathname); }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} sidebarOpen={sidebarOpen} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={`pt-12 transition-all duration-300 flex-1 flex flex-col ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
        <div className="pt-1 px-4 pb-3 md:pt-1.5 md:px-3 md:pb-3 flex-1">
          {children}
        </div>

        <footer className="text-center sm:text-left font-bold px-4 py-3 border-t border-gray-200 bg-white text-[12px] text-[#869099] uppercase tracking-wide leading-relaxed">
          COPYRIGHT &copy; 2025&nbsp;
          <a
            href="https://www.rucha.co.in"
            target="_blank"
            rel="noreferrer"
            className="text-primary font-bold hover:underline normal-case"
            style={{ color: '#3482AE' }}
          >
            RUCHA ENGINEERS PVT. LTD.
          </a>
          . <span className="text-gray-500 font-normal">ALL RIGHTS RESERVED.</span>
        </footer>
      </main>
    </div>
  );
}

