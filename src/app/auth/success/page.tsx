// src/app/auth/success/page.tsx
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../components/auth/AuthContext';

function AuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    if (!searchParams) return;
    
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      console.error('Authentication error:', error);
      router.push('/?error=' + error);
      return;
    }

    if (token) {
      // Guardar el token y autenticar al usuario
      login(token);
      
      // Redirigir a la página principal
      router.push('/');
    } else {
      console.error('No token provided');
      router.push('/?error=no_token');
    }
  }, [searchParams, login, router]);

  return (
    <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-gray-50 z-50">
      <div className="max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Autenticando...
        </h2>
        <p className="text-gray-600">
          Por favor espera mientras procesamos tu inicio de sesión.
        </p>
      </div>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-gray-50 z-50">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Cargando...
          </h2>
          <p className="text-gray-600">
            Procesando autenticación.
          </p>
        </div>
      </div>
    }>
      <AuthSuccessContent />
    </Suspense>
  );
}