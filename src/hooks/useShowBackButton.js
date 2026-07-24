import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

/**
 * Custom hook to determine whether to show the back button.
 * It tracks the starting page (the first page loaded after login) in sessionStorage.
 * If the user is on the starting/landing page, it returns false (hides back button),
 * preventing them from navigating back to login or out of the app.
 */
export function useShowBackButton() {
  const location = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const path = location.pathname;

    // Clear the entry path when user goes to login or access-denied
    if (path === '/login' || path === '/access-denied') {
      sessionStorage.removeItem('appEntryPath');
      setShow(false);
      return;
    }

    let entryPath = sessionStorage.getItem('appEntryPath');
    if (!entryPath) {
      entryPath = path;
      sessionStorage.setItem('appEntryPath', entryPath);
    }

    // Only show back button if we are NOT on the entry path
    setShow(path !== entryPath);
  }, [location.pathname]);

  return show;
}
