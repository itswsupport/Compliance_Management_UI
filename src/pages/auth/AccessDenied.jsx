import { useAuth } from '../../context/AuthContext';

const HOME_PORTAL_URL = 'https://replportal.co.in:8443/portal/dashboard.jsp';

export default function AccessDenied() {
  const { logoutUser } = useAuth();

  // to the home portal. logoutUser() always clears localStorage even if the API fails.
  async function handleGoHome() {
    await logoutUser();
    window.location.href = HOME_PORTAL_URL;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <img
            src="/accessDenied2.png"
            alt="Access Denied"
            className="w-1/2 object-contain"
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
  );
}
