import { create } from 'zustand';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'empleado';
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const TOKEN_KEY = 'maja-auth-token';

/** Fetch wrapper that auto-injects the Authorization header when a token is stored. */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data?.error ?? 'Credenciales incorrectas' };
      }

      const data = await res.json();
      const { token, user } = data as { token: string; user: AuthUser };

      localStorage.setItem(TOKEN_KEY, token);
      set({ user, token, isAuthenticated: true });

      return { success: true };
    } catch {
      return { success: false, error: 'Error de conexión. Intente nuevamente.' };
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (!storedToken) {
      set({ isLoading: false, isAuthenticated: false, user: null, token: null });
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY);
        set({ isLoading: false, isAuthenticated: false, user: null, token: null });
        return;
      }

      const data = await res.json();
      const user = data.user as AuthUser;
      set({ user, token: storedToken, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ isLoading: false, isAuthenticated: false, user: null, token: null });
    }
  },
}));
