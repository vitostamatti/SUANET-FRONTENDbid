// components/auth/ProtectedRoute.tsx
'use client';

import React, { ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  fallbackMessage?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallbackMessage = "Acceso no autorizado" 
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Mientras está cargando, mostrar un spinner
  if (isLoading) {
    return (
      <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-gray-50 z-50">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Verificando acceso...
          </h2>
          <p className="text-gray-600">
            Por favor espera mientras verificamos tu autenticación.
          </p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, mostrar mensaje de acceso no autorizado
  if (!isAuthenticated || !user) {
    return (
      <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-gray-50 z-50">
        <div className="max-w-md w-full mx-auto text-center p-8">
          <div className="bg-white rounded-lg shadow-lg p-8 border border-red-200">
            {/* Icono de acceso denegado */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            {/* Título */}
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {fallbackMessage}
            </h1>
            
            {/* Descripción */}
            <p className="text-gray-600 mb-6">
              Para acceder a esta página necesitas estar autenticado. Por favor inicia sesión para continuar.
            </p>
            
            {/* Botón para iniciar sesión */}
            <button
              onClick={() => {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
                window.location.href = `${backendUrl}/api/auth/google`;
              }}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Iniciar sesión con Google
            </button>
            
            {/* Enlace para ir al inicio */}
            <div className="mt-4">
              <button
                onClick={() => window.location.href = '/'}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si está autenticado, mostrar el contenido
  return <>{children}</>;
};

export default ProtectedRoute;