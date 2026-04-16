import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const BRAND_NAVY = '#262e63';

export function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email.trim(), password);

    setLoading(false);

    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(result.error ?? 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top brand header */}
      <div
        className="w-full px-8 py-5 flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: BRAND_NAVY }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 384.2 79.64"
          fill="white"
          className="h-10 w-auto"
          aria-label="Maja Automotores"
        >
          <polygon points="240.46 0 240.46 52.83 223.88 52.83 223.88 13.55 181.77 52.83 162.35 52.83 219.03 0 240.46 0" />
          <polygon points="152.92 0 152.92 52.83 136.34 52.83 136.34 13.55 94.22 52.83 78.05 52.83 78.05 13.55 35.94 52.83 16.96 52.83 0 35.92 9.54 27.11 27.13 43.35 73.64 0 94.63 0 94.63 34.83 131.99 0 152.92 0" />
          <polygon points="323.73 0 342.76 0 286.06 52.83 267.12 52.83 250.12 35.92 259.66 27.11 277.24 43.35 323.73 0" />
          <polygon points="384.2 0 384.2 52.83 367.62 52.83 367.62 13.55 325.51 52.83 306.09 52.83 362.77 0 384.2 0" />
          <text
            transform="translate(75.35 79.02)"
            fontSize="11.94"
            fontFamily="Inter, system-ui, sans-serif"
            fontWeight="600"
            letterSpacing="2.4"
            fill="white"
            opacity="0.65"
          >
            AUTOMOTORES
          </text>
        </svg>
      </div>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold text-slate-900">Iniciar sesión</h1>
              <p className="text-sm text-slate-500 mt-1">Ingresá con tu cuenta de acceso</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@majaautomotores.com"
                autoComplete="email"
                autoFocus
                required
              />

              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />

              {error && (
                <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-100 px-3.5 py-3 text-sm text-red-700">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full mt-2"
              >
                Iniciar sesión
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-5">
            Sistema de gestión interno · Maja Automotores
          </p>
        </div>
      </div>
    </div>
  );
}
