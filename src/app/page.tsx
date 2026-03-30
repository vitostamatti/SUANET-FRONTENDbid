//page.tsx - Página principal con autenticación y manejo de usuarios no autorizados
"use client";

import "./globals.css";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../components/auth/AuthContext";
import LoginScreen from "../../components/auth/LoginScreen";
import NavBarMap from "../../components/navBarMap";
import NavbarComplement from "./navbarComplement";
import {
  CoordinateProvider,
  useCoordinates,
} from "../../components/coordinateContext";
import { SidebarProvider } from "../../components/sidebarContext";
import { frontendRegistration } from "../../utils/frontendRegistration";

// ✅ NUEVO: Componente para mostrar error de usuario no autorizado
function UnauthorizedUserMessage({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-gray-50 z-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Acceso No Autorizado
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            El usuario con correo <strong>{email}</strong> no está autorizado
            para acceder al sistema SUANET.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>¿Necesitas acceso?</strong>
              <br />
              Contacta al administrador del sistema para solicitar autorización.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
        >
          Intentar con otra cuenta
        </button>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Sistema SUANET - Secretaría Distrital de Movilidad
          </p>
        </div>
      </div>
    </div>
  );
}

// ✅ NUEVO: Componente para mostrar otros errores de autenticación
function AuthErrorMessage({
  error,
  onClose,
}: {
  error: string;
  onClose: () => void;
}) {
  const getErrorMessage = (errorType: string) => {
    switch (errorType) {
      case "auth_failed":
        return {
          title: "Error de Autenticación",
          message:
            "No se pudo completar la autenticación con Google. Por favor, intenta nuevamente.",
        };
      case "no_user":
        return {
          title: "Error de Usuario",
          message:
            "No se pudo obtener la información de tu cuenta. Por favor, intenta nuevamente.",
        };
      case "no_token":
        return {
          title: "Error de Sesión",
          message:
            "No se pudo establecer la sesión. Por favor, intenta nuevamente.",
        };
      case "server_error":
        return {
          title: "Error del Servidor",
          message:
            "Ocurrió un error interno. Por favor, intenta nuevamente en unos momentos.",
        };
      default:
        return {
          title: "Error",
          message:
            "Ocurrió un error inesperado. Por favor, intenta nuevamente.",
        };
    }
  };

  const { title, message } = getErrorMessage(error);

  return (
    <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-gray-50 z-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600 mb-4">{message}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
        >
          Intentar nuevamente
        </button>
      </div>
    </div>
  );
}

function HomeContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showError, setShowError] = useState<string | null>(null);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(
    null,
  );

  // ✅ MODIFICADO: Google login ahora espera a que el frontend esté registrado
  const handleGoogleLogin = async () => {
    try {
      console.log("🔐 Iniciando Google login...");

      // ✅ CRÍTICO: Asegurar que el frontend esté registrado ANTES de OAuth
      const registrationStatus = frontendRegistration.getRegistrationStatus();
      if (!registrationStatus) {
        console.log("⏳ Registrando frontend antes de OAuth...");
        const result = await frontendRegistration.register();

        if (!result.success) {
          console.error(
            "❌ No se pudo registrar frontend, OAuth podría fallar",
          );
          alert(
            "Error de configuración. Por favor, intenta nuevamente en unos momentos.",
          );
          return;
        }

        console.log(
          "✅ Frontend registrado exitosamente, procediendo con OAuth",
        );
      }

      // ✅ NUEVO: Pequeña pausa para asegurar que el backend procesó el registro
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ✅ CORREGIDO: Usar el origin actual del browser para OAuth
      const frontendUrl = window.location.origin; // Usar el origin real del browser
      console.log(`🚀 Redirigiendo a Google OAuth desde: ${frontendUrl}`);
      console.log(`🔍 Window location: ${window.location.href}`);
      window.location.href = `${frontendUrl}/api/auth/google`;
    } catch (error) {
      console.error("❌ Error en handleGoogleLogin:", error);
      alert("Error al iniciar sesión. Por favor, intenta nuevamente.");
    }
  };

  // ✅ MODIFICADO: Manejar errores de autenticación incluyendo usuarios no autorizados
  useEffect(() => {
    if (!searchParams) return;

    const error = searchParams.get("error");
    const email = searchParams.get("email");

    if (error) {
      console.error("Authentication error:", error);

      if (error === "unauthorized_user" && email) {
        setUnauthorizedEmail(decodeURIComponent(email));
        setShowError(null);
      } else {
        setShowError(error);
        setUnauthorizedEmail(null);
      }
    }
  }, [searchParams]);

  const handleCloseError = () => {
    setShowError(null);
    setUnauthorizedEmail(null);
    // Limpiar los parámetros de URL
    router.replace("/");
  };

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-gray-50 z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando SUANET...</p>
          <p className="text-gray-400 text-sm mt-2">
            Configurando conexión con servidor...
          </p>
        </div>
      </div>
    );
  }

  // ✅ NUEVO: Mostrar mensaje para usuarios no autorizados
  if (unauthorizedEmail) {
    return (
      <UnauthorizedUserMessage
        email={unauthorizedEmail}
        onClose={handleCloseError}
      />
    );
  }

  // ✅ NUEVO: Mostrar mensaje para otros errores de autenticación
  if (showError) {
    return <AuthErrorMessage error={showError} onClose={handleCloseError} />;
  }

  // Si no está autenticado, mostrar pantalla de login
  if (!isAuthenticated) {
    return (
      <div className="w-full h-screen">
        <LoginScreen onGoogleLogin={handleGoogleLogin} />
      </div>
    );
  }

  // Si está autenticado, mostrar la aplicación principal
  return (
    <>
      <CoordinateProvider>
        <Suspense>
          <SidebarProvider>
            <NavbarComplement />
          </SidebarProvider>
        </Suspense>

        <main className="layout__main-content">
          <Suspense>
            <NavBarMapWithCoordinates />
          </Suspense>
        </main>
      </CoordinateProvider>
    </>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-gray-50 z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Preparando SUANET...</p>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

const NavBarMapWithCoordinates: React.FC = () => {
  const { lat, lng, vistaTrafico, futureAlertFocus } = useCoordinates();

  useEffect(() => {
    //console.log(`Updated coordinates: Lat - ${lat}, Lng - ${lng}, Vista Trafico - ${vistaTrafico}`);
  }, [lat, lng, vistaTrafico]);

  return (
    <NavBarMap
      lat={lat}
      lng={lng}
      vistaTrafico={vistaTrafico}
      futureAlertFocus={futureAlertFocus}
    />
  );
};
