'use client'

import { useEffect } from 'react';
import { SidebarProvider } from '../../components/sidebarContext';
import { AuthProvider } from '../../components/auth/AuthContext';
import ConditionalNavbar from './navbar';
import { frontendRegistration } from '../../utils/frontendRegistration';
import axios from 'axios';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  useEffect(() => {
    const initializeFrontend = async () => {
      try {
        console.log('🚀 PASO 1: Registrando frontend con backend (ANTES de autenticación)...');

        const result = await frontendRegistration.register();

        if (result.success) {
          console.log('✅ PASO 1 COMPLETADO: Frontend registrado exitosamente');
          console.log('📡 Backend conoce la URL del frontend para OAuth callbacks');
        } else {
          console.warn('⚠️ PASO 1 FALLÓ: No se pudo registrar frontend:', result.message);
          console.warn('⚠️ OAuth callbacks podrían fallar por URL incorrecta');
        }
      } catch (error) {
        console.error('❌ PASO 1 ERROR CRÍTICO en registro de frontend:', error);
        console.error('❌ Esto afectará las redirecciones de OAuth');
      }
    };

    // ✅ NUEVO: Detectar bypass_token para browser automation
    const handleBypassAuth = async () => {
      if (typeof window === 'undefined') return;

      const urlParams = new URLSearchParams(window.location.search);
      const bypassToken = urlParams.get('bypass_token');

      if (bypassToken) {
        console.log('🤖 Bypass token detectado, iniciando autenticación automática...');

        try {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || window.location.origin;

          // Llamar al endpoint de bypass
          const response = await axios.post(`${backendUrl}/api/auth/bypass`, {
            secret: bypassToken
          });

          if (response.data.success) {
            console.log('✅ Bypass exitoso, token obtenido');

            // El token se establecerá mediante el AuthContext después del mount
            // Por ahora, guardarlo en localStorage para que AuthContext lo detecte
            localStorage.setItem('bypass_auth_token', response.data.token);

            // Limpiar el query parameter de la URL
            urlParams.delete('bypass_token');
            const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
            window.history.replaceState({}, '', newUrl);

            console.log('🔄 URL limpiada, recargando para aplicar autenticación...');
            window.location.reload();
          } else {
            console.error('❌ Bypass fallido:', response.data.message);
          }
        } catch (error) {
          console.error('❌ Error en bypass de autenticación:', error);
        }
      }
    };

    initializeFrontend();
    handleBypassAuth();

    const handleFocus = () => {
      console.log('🔄 Ventana recuperó el foco, re-registrando frontend...');
      initializeFrontend();
    };

    const handleOnline = () => {
      console.log('🌐 Conexión restaurada, re-registrando frontend...');
      initializeFrontend();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // CSP/nonce handling removed for video streaming compatibility

  return (
    <AuthProvider>
      <SidebarProvider>
        <ConditionalNavbar />
      </SidebarProvider>
      {children} 
    </AuthProvider>
  );
}