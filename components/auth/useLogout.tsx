'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

export const useLogout = () => {
  const { logout } = useAuth();
  const router = useRouter();

  const logoutAndRedirect = useCallback(async () => {
    try {
      console.log('🚪 Iniciando logout con redirección');
      
      // Ejecutar logout del contexto
      await logout();
      
      // Asegurar redirección a home
      setTimeout(() => {
        router.replace('/');
      }, 100);
      
    } catch (error) {
      console.error('Error en logout:', error);
      // En caso de error, forzar redirección anyway
      router.replace('/');
    }
  }, [logout, router]);

  return { logoutAndRedirect };
};