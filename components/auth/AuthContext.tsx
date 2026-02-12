// components/auth/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { frontendRegistration } from '../../utils/frontendRegistration';

export interface Button {
  id: string;
  name: string;
  enabled: boolean;
}

export interface Control {
  id: string;
  name: string;
  enabled: boolean;
  buttons?: Button[];
}

export interface Submodule {
  id: string;
  name: string;
  enabled: boolean;
}

export interface Permission {
  id: string;
  name: string;
  enabled: boolean;
  submodules?: Submodule[];
  controls?: Control[];
}

export interface User {
  id: number;
  email: string;
  nombre: string;
  avatar_url?: string;
  rol: string;
  permisos: Permission[];
  activo: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const initialized = useRef(false);
  const checkingAuth = useRef(false);

  // ✅ CORREGIDO: Usar URL base, el proxy se encarga de /api
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  // ✅ MODIFICADO: checkAuth ahora espera a que el frontend esté registrado
  const checkAuth = useCallback(async () => {
    // Evitar múltiples llamadas simultáneas
    if (checkingAuth.current) {
      console.log('🔍 checkAuth: Ya hay una verificación en progreso, saltando');
      return;
    }

    checkingAuth.current = true;

    try {
      console.log('🔍 PASO 2: Iniciando verificación de autenticación...');
      setIsLoading(true);

      // ✅ NUEVO: Esperar a que el frontend esté registrado ANTES de verificar auth
      const registrationStatus = frontendRegistration.getRegistrationStatus();
      if (!registrationStatus) {
        console.log('⏳ Frontend aún no registrado, esperando...');

        // Intentar registrar una vez más
        const registrationResult = await frontendRegistration.register();
        if (!registrationResult.success) {
          console.warn('⚠️ No se pudo registrar frontend, continuando con auth...');
        } else {
          console.log('✅ Frontend registrado exitosamente antes de auth check');
        }
      }

      // ✅ NUEVO: Detectar token de bypass en localStorage
      const bypassToken = typeof window !== 'undefined' ? localStorage.getItem('bypass_auth_token') : null;
      if (bypassToken) {
        console.log('🤖 Token de bypass detectado en localStorage, estableciendo...');
        Cookies.set('suanet_token', bypassToken, {
          expires: 7,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        });
        axios.defaults.headers.common['Authorization'] = `Bearer ${bypassToken}`;
        localStorage.removeItem('bypass_auth_token'); // Limpiar después de usar
      }

      const token = Cookies.get('suanet_token');

      console.log('🔍 checkAuth: Token encontrado:', !!token);
      
      if (!token) {
        console.log('🔍 checkAuth: Sin token, estableciendo como no autenticado');
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return;
      }

      console.log('🔍 checkAuth: Haciendo petición a /api/auth/me (via proxy)');
      const response = await axios.get(`${backendUrl}/api/auth/me`);
      
      console.log('🔍 checkAuth: Respuesta recibida:', response.data);
      
      if (response.data.success) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        console.log('✅ PASO 2 COMPLETADO: Usuario autenticado exitosamente');
      } else {
        console.log('🔍 checkAuth: Respuesta no exitosa, limpiando sesión');
        // No llamar logout() para evitar bucle, solo limpiar estado
        Cookies.remove('suanet_token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('🔍 checkAuth: Error en verificación:', error);
      // No llamar logout() para evitar bucle, solo limpiar estado
      Cookies.remove('suanet_token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
      checkingAuth.current = false;
      console.log('🔍 checkAuth: Verificación completada');
    }
  }, [backendUrl]);

  // ✅ MODIFICADO: login ahora asegura que el frontend esté registrado
  const login = useCallback(async (token: string) => {
    console.log('🔐 Login iniciado con token');
    
    try {
      // ✅ NUEVO: Asegurar registro antes de login
      const registrationStatus = frontendRegistration.getRegistrationStatus();
      if (!registrationStatus) {
        console.log('🔄 Registrando frontend antes de completar login...');
        await frontendRegistration.register();
      }

      Cookies.set('suanet_token', token, { 
        expires: 7, // 7 días
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Verificar autenticación después de establecer el token
      await checkAuth();
    } catch (error) {
      console.error('Error en login:', error);
      // En caso de error, continuar con el proceso normal
      checkAuth();
    }
  }, [checkAuth]);

  // ✅ MODIFICADO: logout actualiza el registro del frontend
  const logout = useCallback(async () => {
    console.log('🚪 Logout iniciado');
    try {
      const token = Cookies.get('suanet_token');
      if (token) {
        await axios.post(`${backendUrl}/api/auth/logout`);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      Cookies.remove('suanet_token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      initialized.current = false;
      checkingAuth.current = false;
      
      // ✅ NUEVO: Re-registrar frontend después del logout
      try {
        console.log('🔄 Re-registrando frontend después de logout...');
        await frontendRegistration.register();
      } catch (registrationError) {
        console.warn('⚠️ Error re-registrando frontend después de logout:', registrationError);
      }
      
      // CRÍTICO: Redirección automática después del logout
      if (typeof window !== 'undefined') {
        // Limpiar toda la navegación y forzar redirección a home
        window.location.replace('/');
      }
    }
  }, [backendUrl]);

  // Configurar axios con interceptors
  useEffect(() => {
    const token = Cookies.get('suanet_token');
    
    // Configurar axios para enviar cookies
    axios.defaults.withCredentials = true;
    
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Interceptor para manejar errores de autenticación
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          // Evitar bucle infinito durante logout y checkAuth
          if (!error.config.url?.includes('/auth/logout') && 
              !error.config.url?.includes('/auth/me') && 
              !checkingAuth.current) {
            console.log('😱 Error de autenticación, cerrando sesión');
            logout();
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [logout]); // Depende de logout

  // ✅ MODIFICADO: Verificar autenticación solo después de que todo esté listo
  useEffect(() => {
    // ✅ NUEVO: Esperar un poco para que el layout complete el registro
    const initializeAuth = async () => {
      // Esperar que el frontend se registre primero
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts && !frontendRegistration.getRegistrationStatus()) {
        console.log(`⏳ Esperando registro de frontend... (intento ${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (!initialized.current) {
        console.log('🚀 AuthProvider: Inicializando después de registro de frontend');
        initialized.current = true;
        checkAuth();
      }
    };

    // Ejecutar después de un breve delay para permitir que layout complete el registro
    setTimeout(initializeAuth, 100);
  }, [checkAuth]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};