import { AuthProvider } from './context/AuthContext';
import AppRouter from './routes/AppRouter';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-xs',
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#f8fafc',
          },
        }}
      />
    </AuthProvider>
  );
}
