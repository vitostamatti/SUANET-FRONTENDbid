'use client'

import { Suspense } from 'react';
import RoleAdministration from '../../../../components/admin/RoleAdministration';
import LoadingScreen from '../../../../components/loadingScreen';
import { useAuth } from '../../../../components/auth/AuthContext';

export default function AdminRolesPage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Mostrar loading mientras se carga la autenticación
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Redirigir si no está autenticado
  if (!isAuthenticated) {
    return (
      <div className="p-4 text-center">
        <h1 className="text-xl text-red-600">Acceso denegado</h1>
        <p>Debes iniciar sesión para acceder a esta página.</p>
      </div>
    );
  }

  // Verificar que sea administrador o desarrollador
  if (user?.rol !== 'Administrador' && user?.rol !== 'Desarrollador') {
    return (
      <div className="p-4 text-center">
        <h1 className="text-xl text-red-600">Acceso restringido</h1>
        <p>Solo los administradores y desarrolladores pueden acceder a esta página.</p>
        <p className="text-sm text-gray-600 mt-2">Tu rol actual: {user?.rol}</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <RoleAdministration />
    </Suspense>
  );
}