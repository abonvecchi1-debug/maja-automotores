import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { GlassBackdrop } from '../components/Layout';

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
    <div className="relative min-h-screen flex flex-col bg-[#eceef7]">
      <GlassBackdrop />
      {/* Logo */}
      <div className="relative w-full px-8 pt-14 pb-2 flex items-center justify-center flex-shrink-0">
        {/* Logo oficial (PNG con la bajada en la tipografía de la marca) usado como
            silueta y pintado en azul Maja, para que se vea sobre el fondo claro. */}
        <div
          role="img"
          aria-label="Maja Automotores"
          className="h-14 aspect-[385/80]"
          style={{
            backgroundColor: BRAND_NAVY,
            WebkitMaskImage: 'url(/maja-logo-blanco.png)',
            maskImage: 'url(/maja-logo-blanco.png)',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        />
      </div>

      {/* Login card */}
      <div className="relative flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="glass rounded-[28px] p-8">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Iniciar sesión</h1>
              <p className="text-sm text-slate-600 mt-1">Ingresá con tu cuenta de acceso</p>
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
                <div className="flex items-start gap-2.5 rounded-xl bg-[#ff3b30]/10 px-3.5 py-3 text-sm text-[#c2000f]">
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

          <p className="text-center text-xs text-slate-600 mt-5">
            Sistema de gestión interno · Maja Automotores
          </p>
        </div>
      </div>
    </div>
  );
}
