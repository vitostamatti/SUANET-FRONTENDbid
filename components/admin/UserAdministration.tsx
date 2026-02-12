'use client'

import React, { useState, useEffect, Fragment } from 'react';
import { Card, Title, Text, Button, Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@tremor/react';
import { Dialog, Transition } from '@headlessui/react';
import { 
  UserPlusIcon, 
  PencilIcon, 
  TrashIcon, 
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  ClockIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../auth/AuthContext';
import LoadingScreen from '../loadingScreen';

// Interfaces
interface User {
  id: number;
  email: string;
  nombre: string;
  google_id: string | null;
  avatar_url: string | null;
  rol_id: number;
  rol_nombre: string;
  permisos: string[];
  activo: boolean;
  created_at: string;
  updated_at: string;
  sesiones_activas: number;
}

interface Role {
  id: number;
  nombre: string;
  permisos: string[];
  descripcion: string;
}

interface UserStats {
  total_usuarios: number;
  usuarios_activos: number;
  usuarios_inactivos: number;
  usuarios_con_google: number;
  usuarios_con_sesiones_activas: number;
  usuarios_por_rol: Array<{
    rol_nombre: string;
    cantidad_usuarios: number;
  }>;
}

// Componente Modal para Crear Usuario
function CreateUserModal({ 
  isOpen, 
  closeModal, 
  roles, 
  onUserCreated 
}: { 
  isOpen: boolean;
  closeModal: () => void;
  roles: Role[];
  onUserCreated: () => void;
}) {
  const [createForm, setCreateForm] = useState({
    email: '',
    rol_id: 1 // Administrador por defecto (ID 1 existe en suanet_auth_roles)
  });
  const [loading, setLoading] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

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
    setLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(createForm)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al crear usuario');
      }
      
      alert('Usuario creado exitosamente. El usuario podrá acceder al sistema cuando haga login con Google por primera vez.');
      
      // Limpiar formulario y cerrar modal
      setCreateForm({ email: '', rol_id: 1 });
      closeModal();
      onUserCreated();
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(error.message || 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCreateForm({ email: '', rol_id: 1 });
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  ➕ Crear Nuevo Usuario
                </Dialog.Title>

                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Correo Electrónico *
                      </label>
                      <input
                        type="email"
                        required
                        value={createForm.email}
                        onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                        placeholder="usuario@dominio.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Ingrese un correo electrónico válido
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rol del Sistema
                      </label>
                      <select
                        value={createForm.rol_id}
                        onChange={(e) => setCreateForm({...createForm, rol_id: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      >
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.nombre} - {role.descripcion}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                          Información Importante
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p>• Solo se requiere el email para crear el usuario</p>
                          <p>• El nombre y foto se actualizarán automáticamente en el primer login</p>
                          <p>• El usuario recibirá acceso según el rol asignado</p>
                        </div>
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
                          Crear Usuario
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

// Componente Modal para Editar Usuario
function EditUserModal({ 
  isOpen, 
  closeModal, 
  user, 
  roles, 
  onUserUpdated 
}: { 
  isOpen: boolean;
  closeModal: () => void;
  user: User | null;
  roles: Role[];
  onUserUpdated: () => void;
}) {
  const [editForm, setEditForm] = useState({
    email: '',
    nombre: '',
    rol_id: 1, // Default a Administrador (se sobrescribe con datos del usuario en useEffect)
    activo: true
  });
  const [loading, setLoading] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  useEffect(() => {
    if (user) {
      setEditForm({
        email: user.email,
        nombre: user.nombre,
        rol_id: user.rol_id,
        activo: user.activo
      });
    }
  }, [user]);

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
    if (!user) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editForm)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar usuario');
      }
      
      alert('Usuario actualizado exitosamente');
      closeModal();
      onUserUpdated();
      
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(error.message || 'Error al actualizar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      closeModal();
    }
  };

  if (!user) return null;

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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  ✏️ Editar Usuario: {user.email}
                </Dialog.Title>

                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        value={editForm.nombre}
                        onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                        placeholder="Se actualiza automáticamente con datos de Google"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rol del Sistema
                      </label>
                      <select
                        value={editForm.rol_id}
                        onChange={(e) => setEditForm({...editForm, rol_id: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                      >
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.nombre} - {role.descripcion}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editForm.activo}
                          onChange={(e) => setEditForm({...editForm, activo: e.target.checked})}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          disabled={loading}
                        />
                        <span className="text-sm font-medium text-gray-700">Usuario activo</span>
                      </label>
                    </div>
                  </div>

                  {/* Información del usuario */}
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Información Actual</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Creado:</span>
                        <span className="ml-2 text-gray-900">{new Date(user.created_at).toLocaleDateString('es-CO')}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Actualizado:</span>
                        <span className="ml-2 text-gray-900">{new Date(user.updated_at).toLocaleDateString('es-CO')}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Sesiones activas:</span>
                        <span className="ml-2 text-gray-900">{user.sesiones_activas}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Google ID:</span>
                        <span className="ml-2 text-gray-900">{user.google_id ? 'Conectado' : 'Pendiente'}</span>
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
                          Actualizar Usuario
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
export default function UserAdministration() {
  const { user: currentUser } = useAuth();
  
  // Estados
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Estados para modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

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
        loadUsers(),
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

  const loadUsers = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/users`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar usuarios');
      }
      
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error loading users:', error);
      throw error;
    }
  };

  const loadRoles = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/users/roles`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar roles');
      }
      
      const data = await response.json();
      setRoles(data.roles);
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

  // Eliminar usuario
  const handleDeleteUser = async (user: User) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario ${user.email}?`)) {
      return;
    }
    
    setActionLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al eliminar usuario');
      }
      
      alert('Usuario eliminado exitosamente');
      await loadData(); // Recargar todos los datos
      
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(error.message || 'Error al eliminar usuario');
    } finally {
      setActionLoading(false);
    }
  };

  // Abrir modal de edición
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  // Cerrar modal de edición
  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
  };

  // Callbacks para refrescar datos
  const handleUserCreated = async () => {
    await loadData();
  };

  const handleUserUpdated = async () => {
    await loadData();
  };

  // Obtener badge de rol
  const getRoleBadge = (roleName: string) => {
    const colors: { [key: string]: string } = {
      'Administrador': 'red',
      'Operador': 'blue',
      'Usuario': 'green',
      'Invitado': 'gray'
    };
    
    return (
      <Badge color={colors[roleName] || 'gray'}>
        {roleName}
      </Badge>
    );
  };

  // Obtener badge de estado
  const getStatusBadge = (activo: boolean, sesionesActivas: number) => {
    if (!activo) {
      return <Badge color="red">Inactivo</Badge>;
    }
    
    if (sesionesActivas > 0) {
      return <Badge color="green">En línea</Badge>;
    }
    
    return <Badge color="gray">Activo</Badge>;
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
            👥 Administración de Usuarios
          </Title>
          <Text className="text-gray-600">
            Gestiona los usuarios autorizados del sistema SUANET
          </Text>
        </div>

        {/* Estadísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <Text className="text-sm text-gray-600">Total Usuarios</Text>
                  <Title className="text-2xl">{stats.total_usuarios}</Title>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center">
                <ShieldCheckIcon className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <Text className="text-sm text-gray-600">Sesiones Activas</Text>
                  <Title className="text-2xl">{stats.usuarios_activos}</Title>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center">
                <ClockIcon className="h-8 w-8 text-orange-600 mr-3" />
                <div>
                  <Text className="text-sm text-gray-600">En Línea</Text>
                  <Title className="text-2xl">{stats.usuarios_con_sesiones_activas}</Title>
                </div>
              </div>
            </Card>
            
            <Card>
              <div>
                <Text className="text-sm text-gray-600 mb-2">Por Rol</Text>
                {stats.usuarios_por_rol.map((rol, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{rol.rol_nombre}:</span>
                    <span className="font-semibold">{rol.cantidad_usuarios}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Botón para crear usuario */}
        <div className="mb-6">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <UserPlusIcon className="h-5 w-5 mr-2" />
            Agregar Usuario
          </Button>
        </div>

        {/* Tabla de usuarios */}
        <Card>
          <Title>Usuarios del Sistema</Title>
          <Table className="mt-4">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Correo Electrónico</TableHeaderCell>
                <TableHeaderCell>Nombre</TableHeaderCell>
                <TableHeaderCell>Rol</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell>Último Acceso</TableHeaderCell>
                <TableHeaderCell>Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt="" 
                          className="h-8 w-8 rounded-full mr-3"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-300 mr-3 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.nombre || 'Pendiente de primer login'}
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(user.rol_nombre)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(user.activo, user.sesiones_activas)}
                  </TableCell>
                  <TableCell>
                    {new Date(user.updated_at).toLocaleDateString('es-CO')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => openEditModal(user)}
                        disabled={actionLoading}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button
                          size="xs"
                          color="red"
                          onClick={() => handleDeleteUser(user)}
                          disabled={actionLoading}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>

      {/* Modales */}
      <CreateUserModal
        isOpen={showCreateModal}
        closeModal={() => setShowCreateModal(false)}
        roles={roles}
        onUserCreated={handleUserCreated}
      />

      <EditUserModal
        isOpen={showEditModal}
        closeModal={closeEditModal}
        user={selectedUser}
        roles={roles}
        onUserUpdated={handleUserUpdated}
      />
    </>
  );
}