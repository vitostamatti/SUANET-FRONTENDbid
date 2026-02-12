// components/auth/UserInfo.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from './AuthContext';

const UserInfo: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
  };

  return (
    <div className="relative">
      {/* Avatar o botón de usuario */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center space-x-2 text-sm bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <Image
          src={user.avatar_url || '/images/default-avatar.png'}
          alt={`${user.nombre}'s Avatar`}
          width={50}
          height={50}
          priority
          className="h-8 w-8 rounded-full"
        />
        <span className="hidden md:block text-gray-700 font-medium">
          {user.nombre}
        </span>
        <svg
          className={`hidden md:block h-4 w-4 text-gray-400 transition-transform ${
            isMenuOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Menú desplegable */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
          <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
            {user.email}
          </div>
          <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
            Rol: {user.rol}
          </div>
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
          >
            Cerrar sesión
          </button>
        </div>
      )}

      {/* Overlay para cerrar el menú */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default UserInfo;