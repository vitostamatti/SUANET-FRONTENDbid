// components/auth/usePermissions.tsx
'use client';

import { useAuth } from './AuthContext';
import { Permission, Submodule, Control, Button } from './AuthContext';

export type ModuleId = string;
export type SubmoduleId = string;
export type ControlId = string;
export type ButtonId = string;

interface UsePermissionsReturn {
  /**
   * Verifica si el usuario tiene permiso para acceder a un módulo específico por ID
   * @param moduleId ID del módulo a verificar
   * @returns true si el usuario tiene acceso, false en caso contrario
   */
  hasPermission: (moduleId: ModuleId) => boolean;
  
  /**
   * Verifica si el usuario tiene permiso para acceder a un submódulo específico por ID
   * @param moduleId ID del módulo padre
   * @param submoduleId ID del submódulo a verificar
   * @returns true si el usuario tiene acceso, false en caso contrario
   */
  hasSubmodulePermission: (moduleId: ModuleId, submoduleId: SubmoduleId) => boolean;
  
  /**
   * Obtiene todos los módulos a los que el usuario tiene acceso
   * @returns Array de objetos con id y name de módulos permitidos
   */
  getAllowedModules: () => Array<{ id: string; name: string }>;
  
  /**
   * Obtiene todos los submódulos permitidos para un módulo específico
   * @param moduleId ID del módulo padre
   * @returns Array de objetos con id y name de submódulos permitidos
   */
  getAllowedSubmodules: (moduleId: ModuleId) => Array<{ id: string; name: string }>;
  
  /**
   * Verifica si el usuario es administrador
   * @returns true si el usuario es administrador
   */
  isAdmin: () => boolean;
  
  /**
   * Obtiene los permisos completos del usuario
   * @returns Array de permisos del usuario
   */
  getUserPermissions: () => Permission[];
  
  /**
   * Verifica si un módulo tiene submódulos habilitados
   * @param moduleId ID del módulo a verificar
   * @returns true si tiene al menos un submódulo habilitado
   */
  hasAnySubmoduleEnabled: (moduleId: ModuleId) => boolean;

  /**
   * Obtiene los IDs de todos los módulos disponibles dinámicamente
   * @returns Array de IDs de módulos disponibles
   */
  getAvailableModuleIds: () => string[];

  /**
   * Obtiene los IDs de todos los submódulos disponibles para un módulo
   * @param moduleId ID del módulo padre
   * @returns Array de IDs de submódulos disponibles
   */
  getAvailableSubmoduleIds: (moduleId: ModuleId) => string[];

  /**
   * Obtiene información completa de un módulo por ID
   * @param moduleId ID del módulo
   * @returns Objeto con información del módulo o null si no existe
   */
  getModuleInfo: (moduleId: ModuleId) => { id: string; name: string; enabled: boolean } | null;

  /**
   * Obtiene información completa de un submódulo por ID
   * @param moduleId ID del módulo padre
   * @param submoduleId ID del submódulo
   * @returns Objeto con información del submódulo o null si no existe
   */
  getSubmoduleInfo: (moduleId: ModuleId, submoduleId: SubmoduleId) => { id: string; name: string; enabled: boolean } | null;

  /**
   * Verifica si el usuario tiene permiso para acceder a un control específico por ID
   * @param moduleId ID del módulo padre
   * @param controlId ID del control a verificar
   * @returns true si el usuario tiene acceso, false en caso contrario
   */
  hasControlPermission: (moduleId: ModuleId, controlId: ControlId) => boolean;

  /**
   * Obtiene todos los controls permitidos para un módulo específico
   * @param moduleId ID del módulo padre
   * @returns Array de objetos con id y name de controls permitidos
   */
  getAllowedControls: (moduleId: ModuleId) => Array<{ id: string; name: string }>;

  /**
   * Obtiene los IDs de todos los controls disponibles para un módulo
   * @param moduleId ID del módulo padre
   * @returns Array de IDs de controls disponibles
   */
  getAvailableControlIds: (moduleId: ModuleId) => string[];

  /**
   * Obtiene información completa de un control por ID
   * @param moduleId ID del módulo padre
   * @param controlId ID del control
   * @returns Objeto con información del control o null si no existe
   */
  getControlInfo: (moduleId: ModuleId, controlId: ControlId) => { id: string; name: string; enabled: boolean } | null;

  /**
   * Verifica si el usuario tiene permiso para acceder a un botón específico por ID
   * @param moduleId ID del módulo padre
   * @param controlId ID del control padre
   * @param buttonId ID del botón a verificar
   * @returns true si el usuario tiene acceso, false en caso contrario
   */
  hasButtonPermission: (moduleId: ModuleId, controlId: ControlId, buttonId: ButtonId) => boolean;

  /**
   * Obtiene todos los botones permitidos para un control específico
   * @param moduleId ID del módulo padre
   * @param controlId ID del control padre
   * @returns Array de objetos con id y name de botones permitidos
   */
  getAllowedButtons: (moduleId: ModuleId, controlId: ControlId) => Array<{ id: string; name: string }>;

  /**
   * Obtiene los IDs de todos los botones disponibles para un control
   * @param moduleId ID del módulo padre
   * @param controlId ID del control padre
   * @returns Array de IDs de botones disponibles
   */
  getAvailableButtonIds: (moduleId: ModuleId, controlId: ControlId) => string[];

  /**
   * Obtiene información completa de un botón por ID
   * @param moduleId ID del módulo padre
   * @param controlId ID del control padre
   * @param buttonId ID del botón
   * @returns Objeto con información del botón o null si no existe
   */
  getButtonInfo: (moduleId: ModuleId, controlId: ControlId, buttonId: ButtonId) => { id: string; name: string; enabled: boolean } | null;
}

/**
 * Hook personalizado para manejar verificación de permisos de usuario basado en IDs dinámicos
 */
export const usePermissions = (): UsePermissionsReturn => {
  const { user, isAuthenticated } = useAuth();

  /**
   * Verifica si el usuario tiene permiso para un módulo específico por ID
   */
  const hasPermission = (moduleId: ModuleId): boolean => {
    // Si no está autenticado, no tiene permisos
    if (!isAuthenticated || !user || !user.permisos) {
      return false;
    }

    // Buscar el permiso específico del módulo por ID
    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId && perm.enabled === true
    );

    return !!modulePermission;
  };

  /**
   * Verifica si el usuario tiene permiso para un botón específico por ID
   */
  const hasButtonPermission = (moduleId: ModuleId, controlId: ControlId, buttonId: ButtonId): boolean => {
    // Primero verificar si tiene acceso al control padre
    if (!hasControlPermission(moduleId, controlId)) {
      return false;
    }

    // Si no está autenticado, no tiene permisos
    if (!isAuthenticated || !user || !user.permisos) {
      return false;
    }

    // Buscar el módulo padre
    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId && perm.enabled === true
    );

    // Si no tiene controls, asumir que tiene acceso (retrocompatibilidad)
    if (!modulePermission || !modulePermission.controls) {
      return true;
    }

    // Buscar el control específico por ID
    const controlPermission = modulePermission.controls.find(
      (ctrl: Control) => ctrl.id === controlId && ctrl.enabled === true
    );

    // Si no tiene buttons, asumir que tiene acceso (retrocompatibilidad)
    if (!controlPermission || !controlPermission.buttons) {
      return true;
    }

    // Buscar el botón específico por ID
    const buttonPermission = controlPermission.buttons.find(
      (btn: Button) => btn.id === buttonId && btn.enabled === true
    );

    return !!buttonPermission;
  };

  /**
   * Obtiene todos los botones permitidos para un control específico
   */
  const getAllowedButtons = (moduleId: ModuleId, controlId: ControlId): Array<{ id: string; name: string }> => {
    if (!hasControlPermission(moduleId, controlId) || !user?.permisos) {
      return [];
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId && perm.enabled === true
    );

    if (!modulePermission || !modulePermission.controls) {
      return [];
    }

    const controlPermission = modulePermission.controls.find(
      (ctrl: Control) => ctrl.id === controlId && ctrl.enabled === true
    );

    if (!controlPermission || !controlPermission.buttons) {
      return [];
    }

    return controlPermission.buttons
      .filter((btn: Button) => btn.enabled === true)
      .map((btn: Button) => ({ id: btn.id, name: btn.name }));
  };

  /**
   * Obtiene los IDs de todos los botones disponibles para un control
   */
  const getAvailableButtonIds = (moduleId: ModuleId, controlId: ControlId): string[] => {
    if (!isAuthenticated || !user || !user.permisos) {
      return [];
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId
    );

    if (!modulePermission || !modulePermission.controls) {
      return [];
    }

    const controlPermission = modulePermission.controls.find(
      (ctrl: Control) => ctrl.id === controlId
    );

    if (!controlPermission || !controlPermission.buttons) {
      return [];
    }

    return controlPermission.buttons.map((btn: Button) => btn.id);
  };

  /**
   * Obtiene información completa de un botón por ID
   */
  const getButtonInfo = (moduleId: ModuleId, controlId: ControlId, buttonId: ButtonId): { id: string; name: string; enabled: boolean } | null => {
    if (!isAuthenticated || !user || !user.permisos) {
      return null;
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId
    );

    if (!modulePermission || !modulePermission.controls) {
      return null;
    }

    const controlPermission = modulePermission.controls.find(
      (ctrl: Control) => ctrl.id === controlId
    );

    if (!controlPermission || !controlPermission.buttons) {
      return null;
    }

    const buttonPermission = controlPermission.buttons.find(
      (btn: Button) => btn.id === buttonId
    );

    if (!buttonPermission) {
      return null;
    }

    return {
      id: buttonPermission.id,
      name: buttonPermission.name,
      enabled: buttonPermission.enabled
    };
  };

  /**
   * Verifica si el usuario tiene permiso para un submódulo específico por ID
   */
  const hasSubmodulePermission = (moduleId: ModuleId, submoduleId: SubmoduleId): boolean => {
    // Primero verificar si tiene acceso al módulo padre
    if (!hasPermission(moduleId)) {
      return false;
    }

    // Si no está autenticado, no tiene permisos
    if (!isAuthenticated || !user || !user.permisos) {
      return false;
    }

    // Buscar el módulo padre
    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId && perm.enabled === true
    );

    // Si no tiene submódulos, asumir que tiene acceso (retrocompatibilidad)
    if (!modulePermission || !modulePermission.submodules) {
      return true;
    }

    // Buscar el submódulo específico por ID
    const submodulePermission = modulePermission.submodules.find(
      (subperm: Submodule) => subperm.id === submoduleId && subperm.enabled === true
    );

    return !!submodulePermission;
  };

  /**
   * Obtiene todos los módulos permitidos para el usuario
   */
  const getAllowedModules = (): Array<{ id: string; name: string }> => {
    if (!isAuthenticated || !user || !user.permisos) {
      return [];
    }

    return user.permisos
      .filter((perm: Permission) => perm.enabled === true)
      .map((perm: Permission) => ({ id: perm.id, name: perm.name }));
  };

  /**
   * Obtiene todos los submódulos permitidos para un módulo específico
   */
  const getAllowedSubmodules = (moduleId: ModuleId): Array<{ id: string; name: string }> => {
    if (!hasPermission(moduleId) || !user?.permisos) {
      return [];
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId && perm.enabled === true
    );

    if (!modulePermission || !modulePermission.submodules) {
      return [];
    }

    return modulePermission.submodules
      .filter((subperm: Submodule) => subperm.enabled === true)
      .map((subperm: Submodule) => ({ id: subperm.id, name: subperm.name }));
  };

  /**
   * Verifica si un módulo tiene al menos un submódulo habilitado
   */
  const hasAnySubmoduleEnabled = (moduleId: ModuleId): boolean => {
    const allowedSubmodules = getAllowedSubmodules(moduleId);
    return allowedSubmodules.length > 0;
  };

  /**
   * Verifica si el usuario es administrador o desarrollador
   */
  const isAdmin = (): boolean => {
    return isAuthenticated && (user?.rol === 'Administrador' || user?.rol === 'Desarrollador');
  };

  /**
   * Obtiene los permisos completos del usuario
   */
  const getUserPermissions = (): Permission[] => {
    return user?.permisos || [];
  };

  /**
   * Obtiene los IDs de todos los módulos disponibles dinámicamente
   */
  const getAvailableModuleIds = (): string[] => {
    if (!isAuthenticated || !user || !user.permisos) {
      return [];
    }

    return user.permisos.map((perm: Permission) => perm.id);
  };

  /**
   * Obtiene los IDs de todos los submódulos disponibles para un módulo
   */
  const getAvailableSubmoduleIds = (moduleId: ModuleId): string[] => {
    if (!isAuthenticated || !user || !user.permisos) {
      return [];
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId
    );

    if (!modulePermission || !modulePermission.submodules) {
      return [];
    }

    return modulePermission.submodules.map((subperm: Submodule) => subperm.id);
  };

  /**
   * Obtiene información completa de un módulo por ID
   */
  const getModuleInfo = (moduleId: ModuleId): { id: string; name: string; enabled: boolean } | null => {
    if (!isAuthenticated || !user || !user.permisos) {
      return null;
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId
    );

    if (!modulePermission) {
      return null;
    }

    return {
      id: modulePermission.id,
      name: modulePermission.name,
      enabled: modulePermission.enabled
    };
  };

  /**
   * Obtiene información completa de un submódulo por ID
   */
  const getSubmoduleInfo = (moduleId: ModuleId, submoduleId: SubmoduleId): { id: string; name: string; enabled: boolean } | null => {
    if (!isAuthenticated || !user || !user.permisos) {
      return null;
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId
    );

    if (!modulePermission || !modulePermission.submodules) {
      return null;
    }

    const submodulePermission = modulePermission.submodules.find(
      (subperm: Submodule) => subperm.id === submoduleId
    );

    if (!submodulePermission) {
      return null;
    }

    return {
      id: submodulePermission.id,
      name: submodulePermission.name,
      enabled: submodulePermission.enabled
    };
  };

  /**
   * Verifica si el usuario tiene permiso para un control específico por ID
   */
  const hasControlPermission = (moduleId: ModuleId, controlId: ControlId): boolean => {
    // Primero verificar si tiene acceso al módulo padre
    if (!hasPermission(moduleId)) {
      return false;
    }

    // Si no está autenticado, no tiene permisos
    if (!isAuthenticated || !user || !user.permisos) {
      return false;
    }

    // Buscar el módulo padre
    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId && perm.enabled === true
    );

    // Si no tiene controls, asumir que tiene acceso (retrocompatibilidad)
    if (!modulePermission || !modulePermission.controls) {
      return true;
    }

    // Buscar el control específico por ID
    const controlPermission = modulePermission.controls.find(
      (ctrl: Control) => ctrl.id === controlId && ctrl.enabled === true
    );

    return !!controlPermission;
  };

  /**
   * Obtiene todos los controls permitidos para un módulo específico
   */
  const getAllowedControls = (moduleId: ModuleId): Array<{ id: string; name: string }> => {
    if (!hasPermission(moduleId) || !user?.permisos) {
      return [];
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId && perm.enabled === true
    );

    if (!modulePermission || !modulePermission.controls) {
      return [];
    }

    return modulePermission.controls
      .filter((ctrl: Control) => ctrl.enabled === true)
      .map((ctrl: Control) => ({ id: ctrl.id, name: ctrl.name }));
  };

  /**
   * Obtiene los IDs de todos los controls disponibles para un módulo
   */
  const getAvailableControlIds = (moduleId: ModuleId): string[] => {
    if (!isAuthenticated || !user || !user.permisos) {
      return [];
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId
    );

    if (!modulePermission || !modulePermission.controls) {
      return [];
    }

    return modulePermission.controls.map((ctrl: Control) => ctrl.id);
  };

  /**
   * Obtiene información completa de un control por ID
   */
  const getControlInfo = (moduleId: ModuleId, controlId: ControlId): { id: string; name: string; enabled: boolean } | null => {
    if (!isAuthenticated || !user || !user.permisos) {
      return null;
    }

    const modulePermission = user.permisos.find(
      (perm: Permission) => perm.id === moduleId
    );

    if (!modulePermission || !modulePermission.controls) {
      return null;
    }

    const controlPermission = modulePermission.controls.find(
      (ctrl: Control) => ctrl.id === controlId
    );

    if (!controlPermission) {
      return null;
    }

    return {
      id: controlPermission.id,
      name: controlPermission.name,
      enabled: controlPermission.enabled
    };
  };

  return {
    hasPermission,
    hasSubmodulePermission,
    getAllowedModules,
    getAllowedSubmodules,
    isAdmin,
    getUserPermissions,
    hasAnySubmoduleEnabled,
    getAvailableModuleIds,
    getAvailableSubmoduleIds,
    getModuleInfo,
    getSubmoduleInfo,
    hasControlPermission,
    getAllowedControls,
    getAvailableControlIds,
    getControlInfo,
    hasButtonPermission,
    getAllowedButtons,
    getAvailableButtonIds,
    getButtonInfo
  };
};

/**
 * Hook para verificar permisos específicos de múltiples módulos por IDs
 * Útil para componentes que necesitan verificar varios permisos a la vez
 */
export const useMultiplePermissions = (moduleIds: ModuleId[]) => {
  const { hasPermission } = usePermissions();
  
  const permissions = moduleIds.reduce((acc, moduleId) => {
    acc[moduleId] = hasPermission(moduleId);
    return acc;
  }, {} as Record<ModuleId, boolean>);

  return permissions;
};

/**
 * Hook para verificar permisos de múltiples submódulos por IDs
 */
export const useMultipleSubmodulePermissions = (
  moduleId: ModuleId, 
  submoduleIds: SubmoduleId[]
) => {
  const { hasSubmodulePermission } = usePermissions();
  
  const permissions = submoduleIds.reduce((acc, submoduleId) => {
    acc[submoduleId] = hasSubmodulePermission(moduleId, submoduleId);
    return acc;
  }, {} as Record<SubmoduleId, boolean>);

  return permissions;
};

/**
 * Componente wrapper para renderizar contenido condicionalmente basado en permisos de módulo por ID
 */
interface PermissionWrapperProps {
  children: React.ReactNode;
  requiredModuleId: ModuleId;
  fallback?: React.ReactNode;
}

export const PermissionWrapper: React.FC<PermissionWrapperProps> = ({ 
  children, 
  requiredModuleId, 
  fallback = null 
}) => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(requiredModuleId)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

/**
 * Componente wrapper para renderizar contenido condicionalmente basado en permisos de submódulo por ID
 */
interface SubmodulePermissionWrapperProps {
  children: React.ReactNode;
  requiredModuleId: ModuleId;
  requiredSubmoduleId: SubmoduleId;
  fallback?: React.ReactNode;
}

export const SubmodulePermissionWrapper: React.FC<SubmodulePermissionWrapperProps> = ({ 
  children, 
  requiredModuleId, 
  requiredSubmoduleId,
  fallback = null 
}) => {
  const { hasSubmodulePermission } = usePermissions();
  
  if (!hasSubmodulePermission(requiredModuleId, requiredSubmoduleId)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

/**
 * Componente wrapper para renderizar contenido condicionalmente basado en permisos de control por ID
 */
interface ControlPermissionWrapperProps {
  children: React.ReactNode;
  requiredModuleId: ModuleId;
  requiredControlId: ControlId;
  fallback?: React.ReactNode;
}

export const ControlPermissionWrapper: React.FC<ControlPermissionWrapperProps> = ({ 
  children, 
  requiredModuleId, 
  requiredControlId,
  fallback = null 
}) => {
  const { hasControlPermission } = usePermissions();
  
  if (!hasControlPermission(requiredModuleId, requiredControlId)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

/**
 * Componente wrapper para renderizar contenido condicionalmente basado en permisos de botón por ID
 */
interface ButtonPermissionWrapperProps {
  children: React.ReactNode;
  requiredModuleId: ModuleId;
  requiredControlId: ControlId;
  requiredButtonId: ButtonId;
  fallback?: React.ReactNode;
}

export const ButtonPermissionWrapper: React.FC<ButtonPermissionWrapperProps> = ({ 
  children, 
  requiredModuleId, 
  requiredControlId,
  requiredButtonId,
  fallback = null 
}) => {
  const { hasButtonPermission } = usePermissions();
  
  if (!hasButtonPermission(requiredModuleId, requiredControlId, requiredButtonId)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};