import { createContext, useContext, useMemo } from 'react';

const AuthContext = createContext(null);

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || '{}');
  } catch {
    return {};
  }
}

export function AuthProvider({ children, value }) {
  const fallbackValue = useMemo(() => {
    const usuario = getStoredUser();
    return {
      usuario,
      rol: usuario.rol || ''
    };
  }, []);

  return (
    <AuthContext.Provider value={value || fallbackValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context) return context;

  const usuario = getStoredUser();
  return {
    usuario,
    rol: usuario.rol || ''
  };
}
