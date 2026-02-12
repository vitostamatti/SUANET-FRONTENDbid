//sidebarContext.tsx
'use client';

import { createContext, useState, ReactNode, useContext, useCallback, useMemo, useEffect } from 'react';

interface SidebarContextProps {
  isCollapsed: boolean;
  toggleSidebarcollapse: () => void;
  collapseSidebar: () => void;
  expandSidebar: () => void;
  isMobile: boolean;
}

export const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // CORREGIR: Detectar si es dispositivo móvil usando useEffect
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    
    // Verificar inicialmente
    checkMobile();
    
    // Agregar listener para cambios de tamaño
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile);
      
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []); // Solo ejecutar una vez al montar

  const toggleSidebarcollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const collapseSidebar = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const contextValue = useMemo(() => ({
    isCollapsed,
    toggleSidebarcollapse,
    collapseSidebar,
    expandSidebar,
    isMobile
  }), [isCollapsed, toggleSidebarcollapse, collapseSidebar, expandSidebar, isMobile]);

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = (): SidebarContextProps => {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }

  return context;
};


