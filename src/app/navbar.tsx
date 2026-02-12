//navbar.tsx
'use client';

import { createContext, useState, useContext, Fragment, useEffect  } from 'react';
import { usePathname } from 'next/navigation';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon, BellAlertIcon, CubeTransparentIcon, GlobeAltIcon, CalculatorIcon, HomeIcon, CpuChipIcon, ChartBarIcon, ChartBarSquareIcon, ViewfinderCircleIcon, VideoCameraIcon, FilmIcon, RectangleStackIcon, TruckIcon, BoltIcon, UserCircleIcon, ArrowRightOnRectangleIcon, UserGroupIcon, ShieldCheckIcon, Cog6ToothIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Link from "next/link";
import Image from 'next/image';
import { useSidebar } from '../../components/sidebarContext';
import { useAuth } from '../../components/auth/AuthContext';
import { usePermissions, PermissionWrapper, SubmodulePermissionWrapper } from '../../components/auth/usePermissions';
import LoadingScreen from '../../components/loadingScreen';

function Navbar() {

  const { isCollapsed, toggleSidebarcollapse } = useSidebar();
  const { user, logout, isAuthenticated } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const [loadingPage, setLoadingPage] = useState(false);
  const [backendVersion, setBackendVersion] = useState<string>('loading...');
  const pathname = usePathname();

  // Fetch backend version on mount
  useEffect(() => {
    const fetchBackendVersion = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://suanet-backend-service:8080';
        const response = await fetch(`${backendUrl}/api/version`);

        if (response.ok) {
          const data = await response.json();
          setBackendVersion(data.version || 'unknown');
        } else {
          setBackendVersion('error');
        }
      } catch (error) {
        console.error('Failed to fetch backend version:', error);
        setBackendVersion('error');
      }
    };

    if (isAuthenticated) {
      fetchBackendVersion();
    }
  }, [isAuthenticated]);

  const handleNavigationClick = () => {
    // setLoadingPage(true);

    // setTimeout(() => {
    //   setLoadingPage(false);
    // }, 5000);
  };

  return (
    <div className="sidebar__wrapper">

    {loadingPage && <LoadingScreen />}

    <button className="btn" onClick={toggleSidebarcollapse}>
      {                                                                                                                                    
        isCollapsed ? <Bars3Icon/> : <XMarkIcon/>
      }
    </button>

      <aside className="sidebar" data-collapse={isCollapsed}>

        <div className="sidebar__top">
          <Image
            width={80}
            height={80}
            className="sidebar__logo"
            src="/logoSuanet.png"
            alt="logo"
          />
          <p className="sidebar__logo-name">SUANET</p>
        </div>

        <ul className="sidebar__list">

           {/* Módulo: Home */}
          <PermissionWrapper requiredModuleId="HOME">
            <li className="sidebar__item">
              <Link
                className={`sidebar__link ${
                  pathname === '/' ? "sidebar__link--active" : ""
                }`}
                href="/"
                onClick={handleNavigationClick}
                title="Home"
              >
                <span className="sidebar__icon">
                  <HomeIcon className="h-6 w-6" />
                </span>
                <span className="sidebar__name">Home</span>
              </Link>
            </li>
          </PermissionWrapper>

         
          
        </ul>

        {/* Sección del usuario autenticado */}
        {isAuthenticated && user && (
          <div className="sidebar__user-section">
            <div className="sidebar__user-avatar-container">
              <div className="sidebar__user-info">
                {user.avatar_url ? (
                  <div className="relative">
                    <Image 
                      src={user.avatar_url} 
                      alt={user.nombre || 'Avatar'}
                      width={40}
                      height={40}
                      className="sidebar__user-avatar"
                      onError={(e) => {
                        console.log('Error cargando imagen de avatar');
                        // Ocultar la imagen rota y mostrar el icono de fallback
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        
                        // Mostrar el icono de fallback
                        const fallbackIcon = target.parentElement?.querySelector('.sidebar__user-avatar-fallback') as HTMLElement;
                        if (fallbackIcon) {
                          fallbackIcon.style.display = 'block';
                        }
                      }}
                      onLoad={(e) => {
                        // Asegurar que cuando la imagen se carga correctamente, el fallback esté oculto
                        const target = e.target as HTMLImageElement;
                        const fallbackIcon = target.parentElement?.querySelector('.sidebar__user-avatar-fallback') as HTMLElement;
                        if (fallbackIcon) {
                          fallbackIcon.style.display = 'none';
                        }
                      }}
                      unoptimized
                    />
                    {/* Icono de fallback que se muestra cuando falla la imagen */}
                    <UserCircleIcon 
                      className="sidebar__user-avatar-icon sidebar__user-avatar-fallback" 
                      style={{ 
                        display: 'none',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }}
                    />
                  </div>
                ) : (
                  <UserCircleIcon className="sidebar__user-avatar-icon" />
                )}
                
                {!isCollapsed && (
                  <div className="sidebar__user-details">
                    <p className="sidebar__user-name" style={{ fontSize: '0.85rem' }}>{user.nombre}</p>
                    <p className="sidebar__user-role">{user.rol}</p>
                  </div>
                )}
              </div>

              {/* Botón de logout que aparece en hover */}
              <button
                onClick={logout}
                className="sidebar__logout-btn"
                title="Cerrar sesión"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span className="ml-2">Cerrar sesión</span>
              </button>
            </div>

            {/* Badge de versión - fuera del contenedor del avatar para evitar interferencia */}
            {!isCollapsed && (
              <div style={{
                fontSize: '0.7rem',
                color: '#9ca3af',
                marginTop: '8px',
                paddingLeft: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <span title="Frontend Version">
                  F: {process.env.NEXT_PUBLIC_APP_VERSION || 'dev'}
                </span>
                <span title="Backend Version">
                  B: {backendVersion}
                </span>
              </div>
            )}
          </div>
        )}

      </aside>

      

    </div>
  );
}

// Componente condicional que solo muestra el navbar si el usuario está autenticado
export default function ConditionalNavbar() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // No mostrar nada durante la carga
  if (isLoading) {
    return null;
  }
  
  // Solo mostrar navbar si está autenticado
  if (!isAuthenticated) {
    return null;
  }
  
  return <Navbar />;
}