// components/auth/LoginScreen.tsx
'use client';

import React from 'react';
import Image from 'next/image';

interface LoginScreenProps {
  onGoogleLogin: () => void;
  isLoading?: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onGoogleLogin, isLoading = false }) => {
  return (
    <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 z-50">
      <div className="max-w-lg w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          {/* Logo SUANET */}
          <Image
            src="/logoSuanet.png"
            alt="SUANET Logo"
            width={150}
            height={150}
            priority
            className="mx-auto h-16 w-auto mb-4"
          />
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
            Bienvenido a SUANET
          </h2>
          {/* <p className="text-gray-600 text-sm">
            Sistema Unificado de Análisis de Niveles de Embotellamiento de Tráfico
          </p> */}
        </div>

        <div className="mt-8 space-y-6">
          <div className="text-center">
           
            <button
              onClick={onGoogleLogin}
              disabled={isLoading}
              className={`
                group relative w-full flex justify-center py-3 px-4 border border-transparent 
                text-sm font-medium rounded-md text-white 
                ${isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'suanet-green-btn focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                }
                transition duration-150 ease-in-out
              `}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Conectando...
                </div>
              ) : (
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Inicia sesión con Google
                </div>
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Al continuar, aceptas los términos de uso del sistema SUANET
            </p>
          </div>
        </div>

        {/* Información adicional */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-2">Sistema desarrollado para</p>
            <p className="text-sm font-semibold text-gray-600">Secretaría Distrital de Movilidad</p>
            <p className="text-xs text-gray-500">Alcaldía Mayor de Bogotá</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;