'use client'

import React, { useState, useEffect, Fragment, useCallback, useRef } from 'react';
import { Card, Title, Text, Button, Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@tremor/react';
import { Dialog, Transition } from '@headlessui/react';
import { 
  ShieldCheckIcon,
  PencilIcon, 
  TrashIcon, 
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../auth/AuthContext';
import LoadingScreen from '../loadingScreen';

// Interfaces
interface Button {
  id: string;
  name: string;
  enabled: boolean;
}

interface Permission {
  id: string;
  name: string;
  enabled: boolean;
  controls?: Permission[];
  submodules?: Permission[];
  buttons?: Button[];
}

interface Role {
  id: number;
  nombre: string;
  descripcion: string;
  permisos: Permission[];
  created_at: string;
  updated_at: string;
}

interface RoleStats {
  total_roles: number;
  usuarios_por_rol: Array<{
    rol_nombre: string;
    cantidad_usuarios: string | number; // El backend puede devolver string o number
  }>;
}

// Componente para el editor de permisos expandible
function PermissionEditor({ 
  permissions, 
  onPermissionsChange 
}: { 
  permissions: Permission[];
  onPermissionsChange: (permissions: Permission[]) => void;
}) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  // Función recursiva para obtener todos los IDs expandibles
  const getAllExpandableIds = (items: Permission[]): string[] => {
    const ids: string[] = [];
    
    const collectIds = (item: Permission) => {
      // Si tiene hijos, agregar su ID
      if (item.submodules || item.controls || item.buttons) {
        ids.push(item.id);
      }
      
      // Recursivamente procesar hijos
      item.submodules?.forEach(collectIds);
      item.controls?.forEach(collectIds);
      item.buttons?.forEach(collectIds);
    };
    
    items.forEach(collectIds);
    return ids;
  };

  // Función para seleccionar todos los checkboxes
  const selectAllPermissions = () => {
    const updateAllPermissions = (perms: Permission[]): Permission[] => {
      return perms.map(perm => ({
        ...perm,
        enabled: true,
        submodules: perm.submodules ? updateAllPermissions(perm.submodules) : undefined,
        controls: perm.controls ? updateAllPermissions(perm.controls) : undefined,
        buttons: perm.buttons ? updateAllPermissions(perm.buttons) : undefined
      }));
    };
    
    const newPermissions = updateAllPermissions(permissions);
    onPermissionsChange(newPermissions);
  };

  // Función para desmarcar todos los checkboxes
  const clearAllPermissions = () => {
    const updateAllPermissions = (perms: Permission[]): Permission[] => {
      return perms.map(perm => ({
        ...perm,
        enabled: false,
        submodules: perm.submodules ? updateAllPermissions(perm.submodules) : undefined,
        controls: perm.controls ? updateAllPermissions(perm.controls) : undefined,
        buttons: perm.buttons ? updateAllPermissions(perm.buttons) : undefined
      }));
    };
    
    const newPermissions = updateAllPermissions(permissions);
    onPermissionsChange(newPermissions);
  };

  const updatePermission = (path: number[], enabled: boolean) => {
    // Función para actualizar recursivamente todos los hijos de un elemento
    const updateAllChildren = (perm: Permission, enabled: boolean): Permission => {
      return {
        ...perm,
        enabled,
        submodules: perm.submodules?.map(sub => updateAllChildren(sub, enabled)),
        controls: perm.controls?.map(control => updateAllChildren(control, enabled)),
        buttons: perm.buttons?.map(button => updateAllChildren(button, enabled))
      };
    };

    // Función para verificar si al menos un hijo está habilitado
    const hasEnabledChild = (perm: Permission): boolean => {
      const submodulesEnabled = perm.submodules?.some(sub => sub.enabled || hasEnabledChild(sub)) || false;
      const controlsEnabled = perm.controls?.some(control => control.enabled || hasEnabledChild(control)) || false;
      const buttonsEnabled = perm.buttons?.some(button => button.enabled || hasEnabledChild(button)) || false;
      
      return submodulesEnabled || controlsEnabled || buttonsEnabled;
    };

    // Función para actualizar un elemento y propagar hacia arriba si es necesario
    const updateWithParentPropagation = (perms: Permission[], currentPath: number[]): Permission[] => {
      if (currentPath.length === 1) {
        return perms.map((perm, index) => {
          if (index === currentPath[0]) {
            const updatedPerm = updateAllChildren(perm, enabled);
            return updatedPerm;
          }
          return perm;
        });
      }
      
      return perms.map((perm, index) => {
        if (index === currentPath[0]) {
          const [, ...restPath] = currentPath;
          let updatedPerm = { ...perm };
          
          if (perm.submodules) {
            updatedPerm = {
              ...updatedPerm,
              submodules: updateWithParentPropagation(perm.submodules, restPath)
            };
          }
          if (perm.controls) {
            updatedPerm = {
              ...updatedPerm,
              controls: updateWithParentPropagation(perm.controls, restPath)
            };
          }
          if (perm.buttons) {
            updatedPerm = {
              ...updatedPerm,
              buttons: updateWithParentPropagation(perm.buttons, restPath)
            };
          }
          
          // Si se está habilitando un hijo, habilitar también el padre
          // Si se está deshabilitando y no hay más hijos habilitados, deshabilitar el padre
          if (enabled) {
            updatedPerm.enabled = true;
          } else {
            // Solo deshabilitar el padre si no tiene hijos habilitados
            if (!hasEnabledChild(updatedPerm)) {
              updatedPerm.enabled = false;
            }
          }
          
          return updatedPerm;
        }
        return perm;
      });
    };

    const newPermissions = updateWithParentPropagation(permissions, path);
    onPermissionsChange(newPermissions);
  };

  // Función para determinar el estado de un permission (checked, unchecked, indeterminate)
  const getPermissionState = (perm: Permission): 'checked' | 'unchecked' | 'indeterminate' => {
    const hasChildren = perm.submodules || perm.controls || perm.buttons;
    
    if (!hasChildren) {
      // Si no tiene hijos, el estado depende solo de si está habilitado
      return perm.enabled ? 'checked' : 'unchecked';
    }
    
    // Recopilar todos los hijos
    const allChildren = [
      ...(perm.submodules || []),
      ...(perm.controls || []),
      ...(perm.buttons || [])
    ];
    
    // Obtener los estados de todos los hijos recursivamente
    const childStates = allChildren.map(child => getPermissionState(child));
    
    // Verificar si hay estados mixtos
    const hasChecked = childStates.some(state => state === 'checked');
    const hasUnchecked = childStates.some(state => state === 'unchecked');
    const hasIndeterminate = childStates.some(state => state === 'indeterminate');
    
    // Si hay estados mixtos o indeterminados, este elemento es indeterminado
    if (hasIndeterminate || (hasChecked && hasUnchecked)) {
      return 'indeterminate';
    }
    
    // Si todos los hijos están checked y el elemento actual también está habilitado
    if (hasChecked && !hasUnchecked && perm.enabled) {
      return 'checked';
    }
    
    // Si todos los hijos están unchecked
    if (hasUnchecked && !hasChecked) {
      return 'unchecked';
    }
    
    // Caso por defecto: si todos los hijos están checked pero el elemento actual no está habilitado
    return hasChecked ? 'indeterminate' : 'unchecked';
  };

  // Componente especial para checkbox con estado indeterminado
  const IndeterminateCheckbox = ({ 
    permission, 
    path, 
    onChange 
  }: { 
    permission: Permission; 
    path: number[]; 
    onChange: (path: number[], checked: boolean) => void; 
  }) => {
    const checkboxRef = useRef<HTMLInputElement>(null);
    const permissionState = getPermissionState(permission);
    
    useEffect(() => {
      if (checkboxRef.current) {
        checkboxRef.current.indeterminate = permissionState === 'indeterminate';
      }
    }, [permissionState]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Si el checkbox está en estado indeterminado, al hacer clic lo ponemos en checked
      if (permissionState === 'indeterminate') {
        onChange(path, true);
      } else {
        onChange(path, e.target.checked);
      }
    };

    return (
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={permissionState === 'checked'}
        onChange={handleChange}
        className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
    );
  };

  const renderPermissionItem = (
    permission: Permission, 
    path: number[], 
    level: number = 0
  ) => {
    const hasChildren = permission.submodules || permission.controls || permission.buttons;
    const isExpanded = expandedModules.has(permission.id);
    const paddingLeft = level * 20;

    return (
      <div key={permission.id} className="border border-gray-200 rounded-md mb-2">
        <div 
          className="flex items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
        >
          <div className="mr-2 w-6 h-6 flex items-center justify-center">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleModule(permission.id)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-6 h-6"></div>
            )}
          </div>
          
          <IndeterminateCheckbox
            permission={permission}
            path={path}
            onChange={updatePermission}
          />
          
          <div className="flex-1">
            <span className="font-medium text-gray-900">{permission.name}</span>
          </div>
          
          {(() => {
            const state = getPermissionState(permission);
            const badgeProps = state === 'checked' 
              ? { color: 'green' as const, text: 'Habilitado' }
              : state === 'indeterminate'
              ? { color: 'yellow' as const, text: 'Parcial' }
              : { color: 'red' as const, text: 'Deshabilitado' };
            
            return (
              <Badge color={badgeProps.color}>
                {badgeProps.text}
              </Badge>
            );
          })()}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-t border-gray-200 bg-white">
            {permission.submodules?.map((submodule, index) => 
              renderPermissionItem(submodule, [...path, index], level + 1)
            )}
            {permission.controls?.map((control, index) => 
              renderPermissionItem(control, [...path, index], level + 1)
            )}
            {permission.buttons?.map((button, index) => 
              renderPermissionItem(button, [...path, index], level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-medium text-gray-900">Configuración de Permisos</h4>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExpandedModules(new Set(getAllExpandableIds(permissions)))}
            className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-300 hover:bg-blue-50"
          >
            Expandir Todo
          </button>
          <button
            type="button"
            onClick={() => setExpandedModules(new Set())}
            className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-300 hover:bg-blue-50"
          >
            Colapsar Todo
          </button>
          <button
            type="button"
            onClick={selectAllPermissions}
            className="text-sm text-green-600 hover:text-green-800 px-2 py-1 rounded border border-green-300 hover:bg-green-50"
          >
            Seleccionar Todo
          </button>
          <button
            type="button"
            onClick={clearAllPermissions}
            className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-300 hover:bg-red-50"
          >
            Borrar Todo
          </button>
        </div>
      </div>
      
      {permissions.map((permission, index) => 
        renderPermissionItem(permission, [index])
      )}
    </div>
  );
}

// Modal para crear rol
function CreateRoleModal({ 
  isOpen, 
  closeModal, 
  onRoleCreated 
}: { 
  isOpen: boolean;
  closeModal: () => void;
  onRoleCreated: () => void;
}) {
  const [createForm, setCreateForm] = useState({
    nombre: '',
    descripcion: ''
  });
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  // Estado para almacenar plantilla de permisos del backend
  const [permissionsTemplate, setPermissionsTemplate] = useState<Permission[]>([]);

  const getAuthHeaders = () => {
    let token: string | undefined = document.cookie
      .split('; ')
      .find(row => row.startsWith('suanet_token='))
      ?.split('=')[1];
    
    if (!token && typeof window !== 'undefined') {
      const storageToken = localStorage.getItem('suanet_token');
      token = storageToken ? storageToken : undefined;
    }
    
    return {
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    };
  };

  // Función para obtener permisos desde el backend
  const fetchPermissionsTemplate = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/roles/administrator/template`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener plantilla de permisos');
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching permissions template:', error);
      // Retornar array vacío en caso de error
      return [];
    }
  }, [backendUrl]);

  useEffect(() => {
    if (isOpen) {
      fetchPermissionsTemplate().then(templatePermissions => {
        setPermissionsTemplate(templatePermissions);
        setPermissions(templatePermissions);
      });
    }
  }, [isOpen, fetchPermissionsTemplate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/roles`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...createForm,
          permisos: permissions
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al crear rol');
      }
      
      alert('Rol creado exitosamente');
      
      // Limpiar formulario y cerrar modal
      setCreateForm({ nombre: '', descripcion: '' });
      setPermissions(permissionsTemplate);
      closeModal();
      onRoleCreated();
      
    } catch (error: any) {
      console.error('Error creating role:', error);
      alert(error.message || 'Error al crear rol');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCreateForm({ nombre: '', descripcion: '' });
      setPermissions(permissionsTemplate);
      closeModal();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  ➕ Crear Nuevo Rol
                </Dialog.Title>

                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre del Rol *
                      </label>
                      <input
                        type="text"
                        required
                        value={createForm.nombre}
                        onChange={(e) => setCreateForm({...createForm, nombre: e.target.value})}
                        placeholder="Ej: Editor de Contenido"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={createForm.descripcion}
                        onChange={(e) => setCreateForm({...createForm, descripcion: e.target.value})}
                        placeholder="Describe las responsabilidades del rol"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="mb-8">
                    <PermissionEditor 
                      permissions={permissions}
                      onPermissionsChange={setPermissions}
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                      onClick={handleClose}
                      disabled={loading}
                    >
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creando...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="h-4 w-4 mr-2" />
                          Crear Rol
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Modal para editar rol
function EditRoleModal({ 
  isOpen, 
  closeModal, 
  role, 
  onRoleUpdated 
}: { 
  isOpen: boolean;
  closeModal: () => void;
  role: Role | null;
  onRoleUpdated: () => void;
}) {
  const [editForm, setEditForm] = useState({
    nombre: '',
    descripcion: ''
  });
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  useEffect(() => {
    if (role) {
      setEditForm({
        nombre: role.nombre,
        descripcion: role.descripcion
      });
      setPermissions(role.permisos || []);
    }
  }, [role]);

  const getAuthHeaders = () => {
    let token: string | undefined = document.cookie
      .split('; ')
      .find(row => row.startsWith('suanet_token='))
      ?.split('=')[1];
    
    if (!token && typeof window !== 'undefined') {
      const storageToken = localStorage.getItem('suanet_token');
      token = storageToken ? storageToken : undefined;
    }
    
    return {
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/roles/${role.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...editForm,
          permisos: permissions
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar rol');
      }
      
      alert('Rol actualizado exitosamente');
      closeModal();
      onRoleUpdated();
      
    } catch (error: any) {
      console.error('Error updating role:', error);
      alert(error.message || 'Error al actualizar rol');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      closeModal();
    }
  };

  if (!role) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  ✏️ Editar Rol: {role.nombre}
                </Dialog.Title>

                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre del Rol *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.nombre}
                        onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={editForm.descripcion}
                        onChange={(e) => setEditForm({...editForm, descripcion: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="mb-8">
                    <PermissionEditor 
                      permissions={permissions}
                      onPermissionsChange={setPermissions}
                    />
                  </div>

                  {/* Información del rol */}
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Información del Rol</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Creado:</span>
                        <span className="ml-2 text-gray-900">{new Date(role.created_at).toLocaleDateString('es-CO')}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Actualizado:</span>
                        <span className="ml-2 text-gray-900">{new Date(role.updated_at).toLocaleDateString('es-CO')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                      onClick={handleClose}
                      disabled={loading}
                    >
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Actualizando...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="h-4 w-4 mr-2" />
                          Actualizar Rol
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Componente principal
export default function RoleAdministration() {
  // Estados
  const [roles, setRoles] = useState<Role[]>([]);
  const [stats, setStats] = useState<RoleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Estados para modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  // Obtener token de autenticación
  const getAuthHeaders = () => {
    let token: string | undefined = document.cookie
      .split('; ')
      .find(row => row.startsWith('suanet_token='))
      ?.split('=')[1];
    
    if (!token && typeof window !== 'undefined') {
      const storageToken = localStorage.getItem('suanet_token');
      token = storageToken ? storageToken : undefined;
    }
    
    return {
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    };
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRoles(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/roles`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar roles');
      }
      
      const data = await response.json();
      setRoles(data.data);
    } catch (error) {
      console.error('Error loading roles:', error);
      throw error;
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/users/stats`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar estadísticas');
      }
      
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
      throw error;
    }
  };

  // Eliminar rol
  const handleDeleteRole = async (role: Role) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el rol "${role.nombre}"?`)) {
      return;
    }
    
    setActionLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/roles/${role.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al eliminar rol');
      }
      
      alert('Rol eliminado exitosamente');
      await loadData(); // Recargar todos los datos
      
    } catch (error: any) {
      console.error('Error deleting role:', error);
      alert(error.message || 'Error al eliminar rol');
    } finally {
      setActionLoading(false);
    }
  };

  // Abrir modal de edición
  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setShowEditModal(true);
  };

  // Cerrar modal de edición
  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedRole(null);
  };

  // Callbacks para refrescar datos
  const handleRoleCreated = async () => {
    await loadData();
  };

  const handleRoleUpdated = async () => {
    await loadData();
  };

  // Obtener badge de rol
  const getRoleBadge = (roleName: string) => {
    const colors: { [key: string]: string } = {
      'Administrador': 'red',
      'Operador': 'blue',
      'Usuario': 'green',
      'Invitado': 'gray',
      'Editor de Contenido': 'orange'
    };
    
    return (
      <Badge color={colors[roleName] || 'gray'}>
        {roleName}
      </Badge>
    );
  };

  // Contar permisos habilitados
  const countEnabledPermissions = (permissions: Permission[]): number => {
    const countInPermission = (perm: Permission): number => {
      let count = perm.enabled ? 1 : 0;
      
      if (perm.submodules) {
        count += perm.submodules.reduce((sum, sub) => sum + countInPermission(sub), 0);
      }
      
      if (perm.controls) {
        count += perm.controls.reduce((sum, control) => sum + countInPermission(control), 0);
      }
      
      if (perm.buttons) {
        count += perm.buttons.reduce((sum, button) => sum + countInPermission(button), 0);
      }
      
      return count;
    };
    
    return permissions.reduce((sum, perm) => sum + countInPermission(perm), 0);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <div className="text-center text-red-600">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
            <Text>{error}</Text>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <main className="p-4 md:p-6 mx-auto max-w-7xl h-screen overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <Title className="text-2xl font-bold text-gray-900 mb-2">
            🛡️ Administración de Roles
          </Title>
          <Text className="text-gray-600">
            Gestiona los roles y permisos del sistema SUANET
          </Text>
        </div>

        {/* Estadísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <div className="flex items-center">
                <ShieldCheckIcon className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <Text className="text-sm text-gray-600">Total Roles</Text>
                  <Title className="text-2xl">{roles.length}</Title>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <Text className="text-sm text-gray-600">Usuarios Asignados</Text>
                  <Title className="text-2xl">
                    {stats.usuarios_por_rol.reduce((sum, rol) => sum + parseInt(rol.cantidad_usuarios.toString(), 10), 0)}
                  </Title>
                </div>
              </div>
            </Card>
            
            <Card>
              <div>
                <Text className="text-sm text-gray-600 mb-2">Distribución por Rol</Text>
                {stats.usuarios_por_rol.map((rol, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{rol.rol_nombre}:</span>
                    <span className="font-semibold">{parseInt(rol.cantidad_usuarios.toString(), 10)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Botón para crear rol */}
        <div className="mb-6">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Agregar Rol
          </Button>
        </div>

        {/* Tabla de roles */}
        <Card>
          <Title>Roles del Sistema</Title>
          <Table className="mt-4">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nombre del Rol</TableHeaderCell>
                <TableHeaderCell>Descripción</TableHeaderCell>
                <TableHeaderCell>Permisos Activos</TableHeaderCell>
                <TableHeaderCell>Fecha Creación</TableHeaderCell>
                <TableHeaderCell>Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <ShieldCheckIcon className="h-6 w-6 text-gray-400 mr-3" />
                      <div>
                        <div className="font-medium">{role.nombre}</div>
                        {getRoleBadge(role.nombre)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Text>{role.descripcion || 'Sin descripción'}</Text>
                  </TableCell>
                  <TableCell>
                    <Badge color="blue">
                      {countEnabledPermissions(role.permisos)} permisos
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(role.created_at).toLocaleDateString('es-CO')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => openEditModal(role)}
                        disabled={actionLoading}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        onClick={() => handleDeleteRole(role)}
                        disabled={actionLoading}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>

      {/* Modales */}
      <CreateRoleModal
        isOpen={showCreateModal}
        closeModal={() => setShowCreateModal(false)}
        onRoleCreated={handleRoleCreated}
      />

      <EditRoleModal
        isOpen={showEditModal}
        closeModal={closeEditModal}
        role={selectedRole}
        onRoleUpdated={handleRoleUpdated}
      />
    </>
  );
}