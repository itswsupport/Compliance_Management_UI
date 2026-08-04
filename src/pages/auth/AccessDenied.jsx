import { useAuth } from '../../context/AuthContext';
import { PORTAL_URL } from '../../utils/constants';

export default function AccessDenied() {
  const { logoutUser } = useAuth();

  // to the home portal. logoutUser() always clears localStorage even if the API fails.
  async function handleGoHome() {
    await logoutUser();
    window.location.href = PORTAL_URL;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="flex justify-center">
          <img
            src={`${import.meta.env.BASE_URL}accessDenied2.png`}
            alt="Access Denied"
            className="w-full object-contain"
            style={{ opacity: 0.8 }}
          />
        </div>

        <h5 className="text-gray-500 font-semibold leading-relaxed text-sm uppercase normal-case">
          Please Contact to<br />
          <a
            href="mailto:itswsupport@ruchagroup.com"
            className="text-blue-500 hover:underline lowercase"
          >
            itswsupport@ruchagroup.com
          </a>,{' '}
          <a href="tel:+917722066395" className="text-blue-500 hover:underline">
            7722066395
          </a>.
        </h5>

        <div className="pt-4">
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#19B0D5] hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-0 outline-none uppercase"
          >
            <i className="fas fa-arrow-circle-left text-base" /> BACK TO HOME
          </button>
        </div>
      </div>
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
    </div>
  );
}
