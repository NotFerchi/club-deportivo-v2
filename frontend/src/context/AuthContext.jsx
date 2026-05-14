import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

function readStorage() {
  try {
    const token = localStorage.getItem('token') || '';
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    return { token, usuario, rol: usuario.rol || '' };
  } catch {
    return { token: '', usuario: {}, rol: '' };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStorage);

  const refresh = useCallback(() => setAuth(readStorage()), []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setAuth({ token: '', usuario: {}, rol: '' });
  }, []);

  // Sincronizar entre pestañas
  useEffect(() => {
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ ...auth, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  // Fallback sin Provider (compatibilidad)
  return { ...readStorage(), refresh: () => {}, logout: () => {} };
}
