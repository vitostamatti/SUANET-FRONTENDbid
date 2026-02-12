'use client'

import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Card, Title, Text, Button, Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@tremor/react';
import { Dialog, Transition } from '@headlessui/react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { useAuth } from '../auth/AuthContext';
import { 
  MapPinIcon,
  PencilIcon, 
  TrashIcon, 
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  VideoCameraIcon,
  SignalIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import LoadingScreen from '../loadingScreen';

// Interfaces
interface Crossing {
  id: number;
  id_cruce: number;
  direccion: string;
  gateway: string;
  ip: string;
  estado: string;
  observaciones_vd: string;
  observaciones_etb: string;
  latitud: number;
  longitud: number;
  last_update: string;
  total_camaras: number;
}

interface Camera {
  id: number;
  id_cruce: number;
  ip: string;
  nomenclatura_camara: string;
  latitud: number;
  longitud: number;
  comentario: string;
  estado: string;
  rotacion: number;
  fuente_coord: string;
  last_update: string;
}

interface CrossingStats {
  total_cruces: number;
  total_camaras: number;
  cruces_activos: number;
  camaras_activas: number;
  estados_cruces: Array<{
    estado: string;
    cantidad: number;
  }>;
  estados_camaras: Array<{
    estado: string;
    cantidad: number;
  }>;
}

// Cache global para contenido de archivos SVG
const svgIconCache = new Map<string, string>();

// Función helper para crear marcadores con SVG estáticos rotados
async function createMarkerIcon(markerIcon: string, rotation: number) {
  // Para archivos SVG estáticos - cargar contenido y aplicar rotación
  if (markerIcon.endsWith('.svg')) {
    try {
      let svgContent: string;
      
      // Verificar si el contenido SVG está en cache
      if (svgIconCache.has(markerIcon)) {
        console.log(`📦 Using cached SVG content for: ${markerIcon}`);
        svgContent = svgIconCache.get(markerIcon)!;
      } else {
        console.log(`🌐 Fetching SVG content for: ${markerIcon}`);
        // Cargar el contenido del archivo SVG por primera vez
        const response = await fetch(markerIcon);
        svgContent = await response.text();
        
        // Guardar en cache para futuras referencias
        svgIconCache.set(markerIcon, svgContent);
        console.log(`💾 Cached SVG content for: ${markerIcon}`);
      }
      
      // Inyectar la rotación en el SVG
      const rotatedSvg = svgContent.replace(
        /<svg([^>]*)>/,
        `<svg$1 style="transform: rotate(${rotation-90}deg); transform-origin: center;">`
      );
      
      // Crear data URL con el SVG rotado
      const rotatedSvgDataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(rotatedSvg)}`;
      
      return {
        url: rotatedSvgDataUrl,
        scaledSize: new window.google.maps.Size(32, 32),
        anchor: new window.google.maps.Point(16, 16)
      };
    } catch (error) {
      console.error('Error loading SVG file:', markerIcon, error);
      // Fallback a un marcador básico en caso de error
      return {
        url: '/camera-icon.svg',
        scaledSize: new window.google.maps.Size(32, 32),
        anchor: new window.google.maps.Point(16, 16)
      };
    }
  }
  // Símbolo para cruces (intersection/crossroads icon) - mantener SVG dinámico como fallback
  else if (markerIcon.includes('centroide')) {
    return {
      path: 'M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2M17 13H13V17H11V13H7V11H11V7H13V11H17V13Z',
      fillColor: '#3182CE',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
      scale: 1.8,
      rotation: rotation,
      anchor: new window.google.maps.Point(12, 12)
    };
  }
  // Símbolo genérico (pin de ubicación) - mantener SVG dinámico como fallback
  else {
    return {
      path: 'M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22S19 14.25 19 9C19 5.13 15.87 2 12 2M12 11.5C10.62 11.5 9.5 10.38 9.5 9S10.62 6.5 12 6.5S14.5 7.62 14.5 9S13.38 11.5 12 11.5Z',
      fillColor: '#805AD5',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
      scale: 1.5,
      rotation: rotation,
      anchor: new window.google.maps.Point(12, 12)
    };
  }
}

// Componente de Google Maps
function GoogleMapComponent({ 
  center, 
  zoom,
  markerIcon = '/streamingSemaforos.svg',
  markerTitle = 'Cámara de video-detección - Arrastra para cambiar ubicación',
  rotation = 0
}: {
  center: { lat: number; lng: number };
  zoom: number;
  markerIcon?: string;
  markerTitle?: string;
  rotation?: number;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [markerPosition, setMarkerPosition] = useState(center);
  const [markerRotation, setMarkerRotation] = useState(rotation);
  const lastCenterRef = useRef(center);
  const [userHasPanned, setUserHasPanned] = useState(false);
  const userInteractionRef = useRef(false);
  const markerDraggingRef = useRef(false);

  // Actualizar la posición del marcador cuando cambie el center (nueva cámara)
  useEffect(() => {
    const lastCenter = lastCenterRef.current;
    
    // Verificar si realmente cambió el center
    const latChanged = Math.abs(lastCenter.lat - center.lat) > 0.000001;
    const lngChanged = Math.abs(lastCenter.lng - center.lng) > 0.000001;
    
    if (latChanged || lngChanged) {
      console.log('Center changed - updating marker from:', lastCenter, 'to:', center);
      
      // Determinar si es un cambio de cámara (cambio significativo) vs actualización por arrastre
      const significantChange = Math.abs(lastCenter.lat - center.lat) > 0.0001 || 
                               Math.abs(lastCenter.lng - center.lng) > 0.0001;
      
      if (significantChange) {
        // Es un cambio de cámara - resetear estado de paneo del usuario
        console.log('🔄 New camera detected - resetting user interaction state');
        setUserHasPanned(false);
        userInteractionRef.current = false;
      }
      
      // Actualizar la posición del marcador
      setMarkerPosition(center);
      
      // Actualizar el marcador inmediatamente si existe
      if (markerRef.current) {
        markerRef.current.setPosition(center);
      }
    }
    
    // Siempre actualizar la referencia
    lastCenterRef.current = center;
  }, [center]);

  // Actualizar la rotación del marcador cuando cambie
  useEffect(() => {
    console.log('🔄 Updating marker rotation to:', rotation);
    setMarkerRotation(rotation);
    
    // Función async interna para manejar la actualización del marcador
    const updateMarkerIcon = async () => {
      if (markerRef.current) {
        console.log('🔄 Setting marker icon with rotation:', rotation);
        const markerSymbol = await createMarkerIcon(markerIcon, rotation);
        markerRef.current.setIcon(markerSymbol);
      } else {
        console.log('❌ No marker reference available for rotation update');
      }
    };
    
    updateMarkerIcon();
  }, [rotation, markerIcon]);

  // Escuchar eventos de cambio de rotación
  useEffect(() => {
    const handleRotationChange = (event: CustomEvent) => {
      const { rotation: newRotation } = event.detail;
      console.log('🌐 Received rotation change event:', newRotation);
      setMarkerRotation(newRotation);
      
      // Actualizar el marcador inmediatamente si existe
      if (markerRef.current) {
        console.log('🌐 Applying rotation from event:', newRotation);
        createMarkerIcon(markerIcon, newRotation).then(markerSymbol => {
          if (markerRef.current) {
            markerRef.current.setIcon(markerSymbol);
          }
        });
      } else {
        console.log('❌ No marker reference available for event rotation update');
      }
    };

    window.addEventListener('markerRotationChanged', handleRotationChange as EventListener);
    
    return () => {
      window.removeEventListener('markerRotationChanged', handleRotationChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const initializeMap = async () => {
      console.log('GoogleMapComponent useEffect:', {
        hasMapRef: !!mapRef.current,
        hasGoogleMaps: !!window.google,
        center,
        zoom
      });

      if (!mapRef.current) {
        console.error('Map ref is not available');
        return;
      }

      if (!window.google) {
        console.error('Google Maps API is not loaded');
        return;
      }

      // Crear el mapa
      if (!mapInstanceRef.current) {
        console.log('Creating new Google Map instance');
        try {
          mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
            center,
            zoom,
            mapTypeId: 'roadmap',
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
          });

          // Crear marcador con símbolo SVG que soporte rotación
          const markerSymbol = await createMarkerIcon(markerIcon, markerRotation);

        markerRef.current = new window.google.maps.Marker({
          position: markerPosition,
          map: mapInstanceRef.current,
          draggable: true,
          icon: markerSymbol,
          title: markerTitle
        });

        // Listener para detectar paneo manual del usuario
        if (mapInstanceRef.current) {
          mapInstanceRef.current.addListener('center_changed', () => {
            // Marcar que el usuario ha interactuado con el mapa solo si no estamos actualizando programáticamente
            if (!userInteractionRef.current) {
              console.log('🖱️ User panned map manually');
              setUserHasPanned(true);
            }
          });
        }

        // Listener para detectar inicio del arrastre
        if (markerRef.current) {
          markerRef.current.addListener('dragstart', () => {
            console.log('🎯 Marker drag started');
            markerDraggingRef.current = true;
          });

          // Listener para actualizaciones en tiempo real mientras se arrastra
          markerRef.current.addListener('drag', (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
              const newLat = event.latLng.lat();
              const newLng = event.latLng.lng();
              const newPosition = { lat: newLat, lng: newLng };
              
              // Actualizar la posición del marcador en el estado local
              setMarkerPosition(newPosition);
              
              // Disparar evento para actualizar el formulario en tiempo real
              window.dispatchEvent(new CustomEvent('markerDragged', {
                detail: { lat: newLat, lng: newLng }
              }));
            }
          });

          // Listener para cuando se termina de arrastrar el marcador
          markerRef.current.addListener('dragend', (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
              const newLat = event.latLng.lat();
              const newLng = event.latLng.lng();
              const newPosition = { lat: newLat, lng: newLng };
              
              console.log('🎯 Marker drag ended:', newPosition);
              
              // Asegurar que la posición final esté guardada
              setMarkerPosition(newPosition);
              
              // Marcar que el usuario ha interactuado con el mapa
              setUserHasPanned(true);
            }
            
            // Finalizar el estado de arrastre
            markerDraggingRef.current = false;
          });
        }

        // Agregar listener para cuando el mapa termine de cargar
        if (mapInstanceRef.current) {
          mapInstanceRef.current.addListener('tilesloaded', () => {
            console.log('Google Maps tiles loaded successfully');
          });
        }


        console.log('Google Map created successfully');
      } catch (error) {
        console.error('Error creating Google Map:', error);
      }
    } else {
      // Solo actualizar centro si el usuario NO ha hecho paneo manual o si es un cambio significativo de cámara
      const significantChange = Math.abs(lastCenterRef.current.lat - center.lat) > 0.0001 || 
                               Math.abs(lastCenterRef.current.lng - center.lng) > 0.0001;
      
      if ((!userHasPanned || significantChange) && !markerDraggingRef.current) {
        console.log('🗺️ Updating map center:', { userHasPanned, significantChange, markerDragging: markerDraggingRef.current, center });
        
        // Marcar que estamos actualizando programáticamente
        userInteractionRef.current = true;
        
        mapInstanceRef.current.setCenter(center);
        mapInstanceRef.current.setZoom(zoom);
        
        // Limpiar el flag después de un breve delay
        setTimeout(() => {
          userInteractionRef.current = false;
        }, 100);
      } else {
        const reason = markerDraggingRef.current ? 'marker is being dragged' : 'user has panned manually';
        console.log(`🚫 Skipping map center update - ${reason}`);
      }
      
      // No actualizar automáticamente la posición del marcador aquí
      // Se maneja en el useEffect específico para evitar conflictos con el arrastre
    }
    };

    initializeMap();
  }, [center, zoom, markerPosition, userHasPanned]);

  return <div ref={mapRef} className="w-full h-full" />;
}

// Modal para crear cruce
function CreateCrossingModal({ 
  isOpen, 
  closeModal, 
  onCrossingCreated 
}: { 
  isOpen: boolean;
  closeModal: () => void;
  onCrossingCreated: () => void;
}) {
  const [createForm, setCreateForm] = useState({
    id_cruce: '',
    direccion: '',
    gateway: '',
    ip: '',
    estado: 'Por visitar',
    observaciones_vd: '',
    observaciones_etb: '',
    latitud: '4.6097',  // Centro de Bogotá
    longitud: '-74.0817' // Centro de Bogotá
  });
  const [loading, setLoading] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  useEffect(() => {
    // Escuchar eventos de arrastre del marcador
    const handleMarkerDrag = (event: CustomEvent) => {
      const { lat, lng } = event.detail;
      setCreateForm(prevForm => ({
        ...prevForm,
        latitud: lat.toFixed(8),
        longitud: lng.toFixed(8)
      }));
    };

    window.addEventListener('markerDragged', handleMarkerDrag as EventListener);
    
    return () => {
      window.removeEventListener('markerDragged', handleMarkerDrag as EventListener);
    };
  }, []);

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
      const response = await fetch(`${backendUrl}/api/admin/cruces`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...createForm,
          latitud: createForm.latitud ? parseFloat(createForm.latitud) : null,
          longitud: createForm.longitud ? parseFloat(createForm.longitud) : null,
          id_cruce: parseInt(createForm.id_cruce)
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al crear cruce');
      }
      
      setCreateForm({
        id_cruce: '',
        direccion: '',
        gateway: '',
        ip: '',
        estado: 'Por visitar',
        observaciones_vd: '',
        observaciones_etb: '',
        latitud: '4.6097',  // Centro de Bogotá
        longitud: '-74.0817', // Centro de Bogotá
      });
      closeModal();
      onCrossingCreated();
      
    } catch (error: any) {
      console.error('Error creating crossing:', error);
      alert(error.message || 'Error al crear cruce');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCreateForm({
        id_cruce: '',
        direccion: '',
        gateway: '',
        ip: '',
        estado: 'Por visitar',
        observaciones_vd: '',
        observaciones_etb: '',
        latitud: '4.6097',  // Centro de Bogotá
        longitud: '-74.0817', // Centro de Bogotá
      });
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
              <Dialog.Panel className="w-full max-w-7xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-6">
                  ➕ Crear Nuevo Cruce
                </Dialog.Title>

                <div className="flex gap-8">
                  {/* Panel izquierdo: Formulario */}
                  <div className="w-[500px] flex-shrink-0">

                    <form onSubmit={handleSubmit}>
                      {/* Fila 1: ID Cruce + Dirección */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ID Cruce *
                          </label>
                          <input
                            type="number"
                            required
                            value={createForm.id_cruce}
                            onChange={(e) => setCreateForm({...createForm, id_cruce: e.target.value})}
                            placeholder="Ej: 1001"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loading}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dirección *
                          </label>
                          <input
                            type="text"
                            required
                            value={createForm.direccion}
                            onChange={(e) => setCreateForm({...createForm, direccion: e.target.value})}
                            placeholder="Ej: AK 11 X CL 66"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      {/* Fila 2: Latitud + Longitud (solo lectura) */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Latitud
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={createForm.latitud}
                            readOnly={true}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100 cursor-not-allowed"
                            title="Las coordenadas se actualizan moviendo el marcador en el mapa"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Longitud
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={createForm.longitud}
                            readOnly={true}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100 cursor-not-allowed"
                            title="Las coordenadas se actualizan moviendo el marcador en el mapa"
                          />
                        </div>
                      </div>

                      {/* Fila 3: Gateway + IP */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Gateway
                          </label>
                          <input
                            type="text"
                            value={createForm.gateway}
                            onChange={(e) => setCreateForm({...createForm, gateway: e.target.value})}
                            placeholder="Ej: 10.100.39.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loading}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            IP
                          </label>
                          <input
                            type="text"
                            value={createForm.ip}
                            onChange={(e) => setCreateForm({...createForm, ip: e.target.value})}
                            placeholder="Ej: 10.100.39.2"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      {/* Fila 4: Estado (campo completo) */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Estado
                        </label>
                        <select
                          value={createForm.estado}
                          onChange={(e) => setCreateForm({...createForm, estado: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={false}
                        >
                          <option value="OK">OK</option>
                          <option value="Tracert en router ETB no progresa a destino">Tracert en router ETB no progresa a destino</option>
                          <option value="Revisión Yunex">Revisión Yunex</option>
                          <option value="Equipo de control aislado">Equipo de control aislado</option>
                          <option value="Sin videodetectores">Sin videodetectores</option>
                          <option value="Por visitar">Por visitar</option>
                        </select>
                      </div>

                      {/* Observaciones Video Detección */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Observaciones Video Detección
                        </label>
                        <textarea
                          value={createForm.observaciones_vd}
                          onChange={(e) => setCreateForm({...createForm, observaciones_vd: e.target.value})}
                          placeholder="Observaciones para el grupo de video detección..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={loading}
                          rows={3}
                        />
                      </div>

                      {/* Observaciones ETB */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Observaciones ETB
                        </label>
                        <textarea
                          value={createForm.observaciones_etb}
                          onChange={(e) => setCreateForm({...createForm, observaciones_etb: e.target.value})}
                          placeholder="Observaciones para ETB..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={loading}
                          rows={3}
                        />
                      </div>

                      {/* Botones */}
                      <div className="flex flex-col space-y-3">
                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                            onClick={handleClose}
                            disabled={loading}
                          >
                            <XMarkIcon className="h-3 w-3 mr-1" />
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                          >
                            {loading ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                Creando...
                              </>
                            ) : (
                              <>
                                <CheckIcon className="h-3 w-3 mr-1" />
                                Agregar Cruce
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Panel derecho: Google Maps */}
                  <div className="flex-1">
                    <div className="h-full min-h-[400px] border border-gray-300 rounded-lg overflow-hidden">
                      <Wrapper 
                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                        render={(status) => {
                          console.log('Google Maps API status (Create Crossing Modal):', status);
                          if (status === 'LOADING') return <div className="w-full h-full flex items-center justify-center bg-gray-100"><p>🗺️ Cargando Google Maps...</p></div>;
                          if (status === 'FAILURE') return <div className="w-full h-full flex items-center justify-center bg-red-100"><p>❌ Error al cargar Google Maps. Verifica el API Key.</p></div>;
                          return <div className="w-full h-full"></div>;
                        }}
                      >
                        <GoogleMapComponent
                          center={{
                            lat: createForm.latitud ? Number(createForm.latitud) : 4.6097,
                            lng: createForm.longitud ? Number(createForm.longitud) : -74.0817
                          }}
                          zoom={11}
                          markerIcon="/centroide.svg"
                          markerTitle="Ubicación del nuevo cruce - Arrastra para cambiar ubicación"
                        />
                      </Wrapper>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Modal para editar cruce
function EditCrossingModal({ 
  isOpen, 
  closeModal, 
  crossing,
  onCrossingUpdated 
}: { 
  isOpen: boolean;
  closeModal: () => void;
  crossing: Crossing | null;
  onCrossingUpdated: () => void;
}) {
  const [editForm, setEditForm] = useState({
    id_cruce: '',
    direccion: '',
    gateway: '',
    ip: '',
    estado: '',
    observaciones_vd: '',
    observaciones_etb: '',
    latitud: '',
    longitud: ''
  });
  const [loading, setLoading] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  useEffect(() => {
    if (crossing) {
      setEditForm({
        id_cruce: crossing.id_cruce.toString(),
        direccion: crossing.direccion,
        gateway: crossing.gateway,
        ip: crossing.ip,
        estado: crossing.estado,
        observaciones_vd: crossing.observaciones_vd || '',
        observaciones_etb: crossing.observaciones_etb || '',
        latitud: crossing.latitud?.toString() || '',
        longitud: crossing.longitud?.toString() || ''
      });
    }
  }, [crossing]);

  useEffect(() => {
    // Escuchar eventos de arrastre del marcador
    const handleMarkerDrag = (event: CustomEvent) => {
      const { lat, lng } = event.detail;
      setEditForm(prevForm => ({
        ...prevForm,
        latitud: lat.toFixed(8),
        longitud: lng.toFixed(8)
      }));
    };

    window.addEventListener('markerDragged', handleMarkerDrag as EventListener);
    
    return () => {
      window.removeEventListener('markerDragged', handleMarkerDrag as EventListener);
    };
  }, []);

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
    if (!crossing) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/cruces/${crossing.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...editForm,
          latitud: editForm.latitud ? parseFloat(editForm.latitud) : null,
          longitud: editForm.longitud ? parseFloat(editForm.longitud) : null,
          id_cruce: parseInt(editForm.id_cruce)
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar cruce');
      }
      
      closeModal();
      onCrossingUpdated();
      
    } catch (error: any) {
      console.error('Error updating crossing:', error);
      alert(error.message || 'Error al actualizar cruce');
    } finally {
      setLoading(false);
    }
  };

  if (!crossing) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
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
              <Dialog.Panel className="w-full max-w-7xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-6">
                  ✏️ Editar Cruce: {crossing.direccion}
                </Dialog.Title>

                <div className="flex gap-8">
                  {/* Panel izquierdo: Formulario */}
                  <div className="w-[500px] flex-shrink-0">
                    <form onSubmit={handleSubmit}>
                      {/* Fila 1: ID Cruce + Dirección */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ID Cruce *
                          </label>
                          <input
                            type="number"
                            required
                            value={editForm.id_cruce}
                            onChange={(e) => setEditForm({...editForm, id_cruce: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100 cursor-not-allowed"
                            disabled={true}
                            title="El ID del cruce no se puede modificar después de creado"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dirección *
                          </label>
                          <input
                            type="text"
                            required
                            value={editForm.direccion}
                            onChange={(e) => setEditForm({...editForm, direccion: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      {/* Fila 2: Latitud + Longitud (bloqueados) */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Latitud
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={editForm.latitud}
                            readOnly={true}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100 cursor-not-allowed"
                            title="Las coordenadas se actualizan moviendo el marcador en el mapa"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Longitud
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={editForm.longitud}
                            readOnly={true}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100 cursor-not-allowed"
                            title="Las coordenadas se actualizan moviendo el marcador en el mapa"
                          />
                        </div>
                      </div>

                      {/* Fila 3: Gateway + IP */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Gateway
                          </label>
                          <input
                            type="text"
                            value={editForm.gateway}
                            onChange={(e) => setEditForm({...editForm, gateway: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loading}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            IP
                          </label>
                          <input
                            type="text"
                            value={editForm.ip}
                            onChange={(e) => setEditForm({...editForm, ip: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      {/* Fila 4: Estado (campo completo) */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Estado
                        </label>
                        <select
                          value={editForm.estado}
                          onChange={(e) => setEditForm({...editForm, estado: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={false}
                        >
                          <option value="OK">OK</option>
                          <option value="Tracert en router ETB no progresa a destino">Tracert en router ETB no progresa a destino</option>
                          <option value="Revisión Yunex">Revisión Yunex</option>
                          <option value="Equipo de control aislado">Equipo de control aislado</option>
                          <option value="Sin videodetectores">Sin videodetectores</option>
                          <option value="Por visitar">Por visitar</option>
                        </select>
                      </div>

                      {/* Observaciones Video Detección */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Observaciones Video Detección
                        </label>
                        <textarea
                          value={editForm.observaciones_vd}
                          onChange={(e) => setEditForm({...editForm, observaciones_vd: e.target.value})}
                          placeholder="Observaciones para el grupo de video detección..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={loading}
                          rows={3}
                        />
                      </div>

                      {/* Observaciones ETB */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Observaciones ETB
                        </label>
                        <textarea
                          value={editForm.observaciones_etb}
                          onChange={(e) => setEditForm({...editForm, observaciones_etb: e.target.value})}
                          placeholder="Observaciones para ETB..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={loading}
                          rows={3}
                        />
                      </div>

                      {/* Información del cruce */}
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Información del Cruce</h4>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Última actualización:</span>
                            <span className="ml-2 text-gray-900">{new Date(crossing.last_update).toLocaleString('es-CO')}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total cámaras:</span>
                            <span className="ml-2 text-gray-900">{crossing.total_camaras}</span>
                          </div>
                        </div>
                      </div>

                      {/* Botones */}
                      <div className="flex flex-col space-y-3">
                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                            onClick={closeModal}
                            disabled={loading}
                          >
                            <XMarkIcon className="h-3 w-3 mr-1" />
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                          >
                            {loading ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                Actualizando...
                              </>
                            ) : (
                              <>
                                <CheckIcon className="h-3 w-3 mr-1" />
                                Actualizar Cruce
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Panel derecho: Google Maps */}
                  <div className="flex-1">
                    <div className="h-full min-h-[400px] border border-gray-300 rounded-lg overflow-hidden">
                      <Wrapper 
                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                        render={(status) => {
                          console.log('Google Maps API status (Edit Crossing Modal):', status);
                          if (status === 'LOADING') return <div className="w-full h-full flex items-center justify-center bg-gray-100"><p>🗺️ Cargando Google Maps...</p></div>;
                          if (status === 'FAILURE') return <div className="w-full h-full flex items-center justify-center bg-red-100"><p>❌ Error al cargar Google Maps. Verifica el API Key.</p></div>;
                          return <div className="w-full h-full"></div>;
                        }}
                      >
                        <GoogleMapComponent
                          center={{
                            lat: editForm.latitud ? Number(editForm.latitud) : 4.6097,
                            lng: editForm.longitud ? Number(editForm.longitud) : -74.0817
                          }}
                          zoom={21}
                          markerIcon="/centroide.svg"
                          markerTitle="Ubicación del cruce - Arrastra para cambiar ubicación"
                        />
                      </Wrapper>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Modal para crear cámara
function CreateCameraModal({ 
  isOpen, 
  closeModal, 
  crossingId,
  crossing,
  onCameraCreated 
}: { 
  isOpen: boolean;
  closeModal: () => void;
  crossingId: number | null;
  crossing: Crossing | null;
  onCameraCreated: () => void;
}) {
  const [createForm, setCreateForm] = useState({
    ip: '',
    nomenclatura_camara: '',
    latitud: crossing?.latitud?.toString() || '',
    longitud: crossing?.longitud?.toString() || '',
    comentario: '',
    estado: 'Activa',
    rotacion: 90 // Rotación del marcador en grados
  });
  const [loading, setLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  // Actualizar coordenadas cuando cambie el crossing
  useEffect(() => {
    if (crossing) {
      setCreateForm(prev => ({
        ...prev,
        latitud: crossing.latitud?.toString() || '',
        longitud: crossing.longitud?.toString() || ''
      }));
    }
  }, [crossing]);

  useEffect(() => {
    // Escuchar eventos de arrastre del marcador
    const handleMarkerDrag = (event: CustomEvent) => {
      const { lat, lng } = event.detail;
      setCreateForm(prevForm => ({
        ...prevForm,
        latitud: lat.toFixed(8),
        longitud: lng.toFixed(8)
      }));
    };

    window.addEventListener('markerDragged', handleMarkerDrag as EventListener);
    
    return () => {
      window.removeEventListener('markerDragged', handleMarkerDrag as EventListener);
    };
  }, []);

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

  // Función para enviar heartbeat
  const sendHeartbeat = async (cameraId: number): Promise<{success: boolean, error?: string}> => {
    try {
      const userEmail = 'create_modal@suanet.local';
      const sessionId = `create_session_${Date.now()}`;
      const userName = 'Vista Previa';
      
      const heartbeatData = {
        user_email: userEmail,
        session_id: sessionId,
        user_name: userName,
        timestamp: new Date().toISOString()
      };

      console.log(`💓 Enviando heartbeat para vista previa cámara ${cameraId}`);
      
      const response = await fetch(`${backendUrl}/api/video_heartbeat_detector/${cameraId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(heartbeatData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        const errorMsg = result.error || `Error HTTP ${response.status}`;
        return { success: false, error: errorMsg };
      }
      
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error de conexión';
      return { success: false, error: errorMsg };
    }
  };

  // Funciones para manejar video streaming
  const handlePlayVideo = async () => {
    if (!crossing) return;
    
    setVideoLoading(true);
    setVideoError(null);
    
    try {
      console.log(`🎥 Iniciando vista previa para cruce ${crossing.id}`);
      
      const dummyCameraId = crossing.id;
      
      const heartbeatResult = await sendHeartbeat(dummyCameraId);
      
      if (!heartbeatResult.success) {
        console.warn(`Heartbeat falló: ${heartbeatResult.error}`);
      }

      setVideoError(null);
      setVideoPlaying(true);
      
      errorTimeoutRef.current = setTimeout(() => {
        setVideoError(`No hay cámaras disponibles en este cruce`);
        setVideoLoading(false);
      }, 15000);
      
      if (heartbeatResult.success) {
        heartbeatIntervalRef.current = setInterval(async () => {
          await sendHeartbeat(dummyCameraId);
        }, 5000);
      }
      
    } catch (error: any) {
      console.error('❌ Error al iniciar vista previa:', error);
      setVideoError(error.message || 'Error al conectar con el video');
      setVideoLoading(false);
    }
  };

  const handleStopVideo = () => {
    console.log('⏹️ Deteniendo vista previa de video');
    setVideoPlaying(false);
    setVideoLoading(false);
    setVideoError(null);
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crossingId) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/camaras`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...createForm,
          id_cruce: crossingId,
          latitud: createForm.latitud ? parseFloat(createForm.latitud) : null,
          longitud: createForm.longitud ? parseFloat(createForm.longitud) : null,
          fuente_coord: 'Modificada por el usuario'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al crear cámara');
      }
      
      alert('Cámara creada exitosamente');
      
      setCreateForm({
        ip: '',
        nomenclatura_camara: '',
        latitud: crossing?.latitud?.toString() || '',
        longitud: crossing?.longitud?.toString() || '',
        comentario: '',
        estado: 'Activa',
        rotacion: 90
      });
      closeModal();
      onCameraCreated();
      
    } catch (error: any) {
      console.error('Error creating camera:', error);
      alert(error.message || 'Error al crear cámara');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Limpiar video y timers
      handleStopVideo();
      
      setCreateForm({
        ip: '',
        nomenclatura_camara: '',
        latitud: crossing?.latitud?.toString() || '',
        longitud: crossing?.longitud?.toString() || '',
        comentario: '',
        estado: 'Activa',
        rotacion: 90
      });
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
              <Dialog.Panel className="w-full transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all flex flex-col" style={{ maxWidth: 'calc(1280px + 200px)' }}>
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  📹 Crear Nueva Cámara - Cruce: {crossing?.id} - {crossing?.direccion}
                </Dialog.Title>
                <div className="flex flex-1">
                  <div className="w-[500px] flex-shrink-0">
                    <form onSubmit={handleSubmit}>
                      <div className="space-y-4">
                        {/* Fila 1: IP + Nomenclatura */}
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              IP *
                            </label>
                            <input
                              type="text"
                              required
                              value={createForm.ip}
                              onChange={(e) => setCreateForm({...createForm, ip: e.target.value})}
                              placeholder="Ej: 10.100.39.5"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled={loading}
                            />
                          </div>
                          
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Nomenclatura
                            </label>
                            <input
                              type="text"
                              value={createForm.nomenclatura_camara}
                              onChange={(e) => setCreateForm({...createForm, nomenclatura_camara: e.target.value})}
                              placeholder="Ej: Cámara 1"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled={loading}
                            />
                          </div>
                        </div>

                        {/* Fila 2: Latitud + Longitud */}
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Latitud
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={createForm.latitud}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                              title="Coordenadas heredadas del cruce padre"
                            />
                          </div>
                          
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Longitud
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={createForm.longitud}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                              title="Coordenadas heredadas del cruce padre"
                            />
                          </div>
                        </div>

                        {/* Fila 3: Estado + Comentario */}
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Estado
                            </label>
                            <select
                              value={createForm.estado}
                              onChange={(e) => setCreateForm({...createForm, estado: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm hover:border-blue-400 cursor-pointer"
                              disabled={loading}
                            >
                              <option value="Activa">Activa</option>
                              <option value="No Alcanzable: IP no responde a conexión TCP">No Alcanzable</option>
                            </select>
                          </div>
                          
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Comentario
                            </label>
                            <input
                              type="text"
                              value={createForm.comentario}
                              onChange={(e) => setCreateForm({...createForm, comentario: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled={loading}
                            />
                          </div>
                        </div>

                        {/* Fila 4: Control de Rotación */}
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Rotación de la cámara (°)
                            </label>
                            <div className="flex items-center space-x-3">
                              <input
                                type="range"
                                min="0"
                                max="360"
                                step="5"
                                value={createForm.rotacion}
                                onChange={(e) => {
                                  const newRotation = parseInt(e.target.value);
                                  console.log('🎯 Slider changed to:', newRotation);
                                  setCreateForm({...createForm, rotacion: newRotation});
                                  console.log('🎯 Dispatching markerRotationChanged event with:', newRotation);
                                  window.dispatchEvent(new CustomEvent('markerRotationChanged', {
                                    detail: { rotation: newRotation }
                                  }));
                                }}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                disabled={loading}
                              />
                              <input
                                type="number"
                                min="0"
                                max="360"
                                step="5"
                                value={createForm.rotacion}
                                onChange={(e) => {
                                  const newRotation = Math.min(360, Math.max(0, parseInt(e.target.value) || 0));
                                  console.log('🔢 Number input changed to:', newRotation);
                                  setCreateForm({...createForm, rotacion: newRotation});
                                  console.log('🔢 Dispatching markerRotationChanged event with:', newRotation);
                                  window.dispatchEvent(new CustomEvent('markerRotationChanged', {
                                    detail: { rotation: newRotation }
                                  }));
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                disabled={loading}
                              />
                              <span className="text-sm text-gray-500 min-w-[20px]">°</span>
                            </div>
                          </div>
                        </div>

                      {/* Reproductor de video */}
                      <div className="mt-6 mb-4">
                        <div 
                          className="border-2 border-solid border-gray-300 bg-black rounded-lg overflow-hidden"
                          style={{ width: '480px', height: '360px' }}
                        >
                            {videoError ? (
                              <div className="w-full h-full flex items-center justify-center text-center text-red-500 p-4">
                                <div>
                                  <div className="text-4xl mb-2">❌</div>
                                  <div className="text-sm">Error al cargar video</div>
                                  <div className="text-xs text-red-400 mt-1">{videoError}</div>
                                </div>
                              </div>
                            ) : videoPlaying && crossing ? (
                              <img
                                src={`${backendUrl}/api/video_detector_feed/${crossing.id}`}
                                alt="Vista previa de cámaras en el cruce"
                                className="w-full h-full object-cover"
                                onLoad={() => {
                                  console.log(`📹 Vista previa cargada exitosamente para cruce ${crossing.id}`);
                                  setVideoLoading(false);
                                  setVideoError(null);
                                  if (errorTimeoutRef.current) {
                                    clearTimeout(errorTimeoutRef.current);
                                    errorTimeoutRef.current = null;
                                  }
                                }}
                                onError={(e) => {
                                  console.error(`Error cargando vista previa para cruce ${crossing.id}:`, e);
                                  setVideoLoading(false);
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-center text-gray-500">
                                <div>
                                  <div className="text-4xl mb-2">📹</div>
                                  <div className="text-sm">Reproductor de video</div>
                                  <div className="text-xs text-gray-400 mt-1">480px × 360px (4:3)</div>
                                  <div className="text-xs text-gray-400 mt-2">Presiona &quot;Play&quot; para iniciar</div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                        {/* Controles de video */}
                        <div className="flex justify-center space-x-3 mt-3">
                            <button
                              type="button"
                              onClick={handlePlayVideo}
                              disabled={videoLoading || videoPlaying || loading}
                              className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                videoPlaying 
                                  ? 'bg-gray-500 cursor-not-allowed' 
                                  : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                              }`}
                            >
                              {videoLoading ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Conectando...
                                </>
                              ) : (
                                <>
                                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                  </svg>
                                  {videoPlaying ? 'Reproduciendo' : 'Play'}
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleStopVideo}
                              disabled={!videoPlaying || loading}
                              className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                              </svg>
                              Stop
                            </button>
                          </div>
                        </div>

                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          type="button"
                          className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                          style={{ paddingTop: '6px', paddingBottom: '6px' }}
                          onClick={handleClose}
                          disabled={loading}
                        >
                          <XMarkIcon className="h-3 w-3 mr-1" />
                          Cancelar
                        </button>
                        
                        <button
                          type="submit"
                          disabled={loading}
                          className="inline-flex justify-center rounded-md border border-transparent bg-green-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                          style={{ paddingTop: '6px', paddingBottom: '6px' }}
                        >
                          {loading ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                              Creando...
                            </>
                          ) : (
                            <>
                              <CheckIcon className="h-3 w-3 mr-1" />
                              Crear Cámara
                            </>
                          )}
                        </button>
                      </div>
                      </div>
                    </form>
                  </div>
                  
                  <div className="flex-1 p-4">
                    <div className="h-full min-h-[400px] border border-gray-200 rounded-lg overflow-hidden">
                      <Wrapper 
                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                        render={(status) => {
                          console.log('Google Maps API status (Create Modal):', status);
                          if (status === 'LOADING') return <div className="w-full h-full flex items-center justify-center bg-gray-100"><p>🗺️ Cargando Google Maps...</p></div>;
                          if (status === 'FAILURE') return <div className="w-full h-full flex items-center justify-center bg-red-100"><p>❌ Error al cargar Google Maps. Verifica el API Key.</p></div>;
                          return <div className="w-full h-full"></div>;
                        }}
                      >
                        <GoogleMapComponent
                          center={{
                            lat: crossing?.latitud ? Number(crossing.latitud) : 4.6097,
                            lng: crossing?.longitud ? Number(crossing.longitud) : -74.0817
                          }}
                          zoom={21}
                          rotation={createForm.rotacion}
                        />
                      </Wrapper>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Modal para editar cámara
function EditCameraModal({ 
  isOpen, 
  closeModal, 
  camera,
  onCameraUpdated,
  cameras,
  onEditNextCamera,
  crossings
}: { 
  isOpen: boolean;
  closeModal: () => void;
  camera: Camera | null;
  onCameraUpdated: () => void;
  cameras?: Camera[];
  onEditNextCamera?: (nextCamera: Camera) => void;
  crossings: Crossing[];
}) {
  const { user } = useAuth();
  
  const [editForm, setEditForm] = useState({
    ip: '',
    nomenclatura_camara: '',
    latitud: '',
    longitud: '',
    comentario: '',
    estado: '',
    rotacion: 0 // Rotación del marcador en grados
  });
  const [loading, setLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  useEffect(() => {
    if (camera) {
      setEditForm({
        ip: camera.ip,
        nomenclatura_camara: camera.nomenclatura_camara,
        latitud: camera.latitud?.toString() || '',
        longitud: camera.longitud?.toString() || '',
        comentario: camera.comentario,
        estado: camera.estado,
        rotacion: camera.rotacion !== undefined ? camera.rotacion : 90
      });
      
      // Limpiar estado del video al cambiar de cámara
      setVideoPlaying(false);
      setVideoError(null);
      setVideoLoading(false);
      
      // Limpiar intervalos y timeouts si existen
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    }
  }, [camera]);

  useEffect(() => {
    // Escuchar eventos de arrastre del marcador
    const handleMarkerDrag = (event: CustomEvent) => {
      const { lat, lng } = event.detail;
      setEditForm(prevForm => ({
        ...prevForm,
        latitud: lat.toFixed(8),
        longitud: lng.toFixed(8)
      }));
    };

    window.addEventListener('markerDragged', handleMarkerDrag as EventListener);
    
    return () => {
      window.removeEventListener('markerDragged', handleMarkerDrag as EventListener);
    };
  }, []);

  // Cleanup effect para limpiar intervalos al desmontar
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    };
  }, []);

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

  // Determinar la siguiente cámara (implementa ciclo: última → primera)
  const getNextCamera = () => {
    if (!cameras || !camera || cameras.length <= 1) return null;
    const currentIndex = cameras.findIndex(c => c.id === camera.id);
    if (currentIndex === -1) return null;
    
    // Si es la última cámara, regresa a la primera (índice 0)
    const nextIndex = (currentIndex + 1) % cameras.length;
    return cameras[nextIndex];
  };

  // Determinar la cámara anterior (implementa ciclo: primera → última)
  const getPreviousCamera = () => {
    if (!cameras || !camera || cameras.length <= 1) return null;
    const currentIndex = cameras.findIndex(c => c.id === camera.id);
    if (currentIndex === -1) return null;
    
    // Si es la primera cámara, va a la última (índice length - 1)
    const previousIndex = currentIndex === 0 ? cameras.length - 1 : currentIndex - 1;
    return cameras[previousIndex];
  };

  // Función para navegar a la cámara anterior sin guardar
  const goToPreviousCamera = () => {
    const previousCamera = getPreviousCamera();
    if (previousCamera && onEditNextCamera) {
      onEditNextCamera(previousCamera);
    }
  };

  // Función para navegar a la cámara siguiente sin guardar
  const goToNextCamera = () => {
    const nextCamera = getNextCamera();
    if (nextCamera && onEditNextCamera) {
      onEditNextCamera(nextCamera);
    }
  };

  // Función para enviar heartbeat (similar a streamingCameras.tsx)
  const sendHeartbeat = async (cameraId: number): Promise<{success: boolean, error?: string}> => {
    try {
      const userEmail = user?.email || 'unknown@email.com';
      const sessionId = user?.id ? `session_${user.id}_${Date.now()}` : 'no_session';
      const userName = user?.nombre || 'Usuario Anónimo';
      
      const heartbeatData = {
        user_email: userEmail,
        session_id: sessionId,
        user_name: userName,
        timestamp: new Date().toISOString()
      };

      console.log(`💓 Enviando heartbeat para video-detectores FLIR cámara ${cameraId} - Usuario: ${userName} (${userEmail})`);

      const response = await fetch(`${backendUrl}/api/video_heartbeat_detector/${cameraId}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(heartbeatData),
      });
      
      console.log(`Respuesta: status=${response.status}, ok=${response.ok}`);
      
      const result = await response.json();
      console.log('Resultado:', result);
      
      if (!response.ok) {
        const errorMsg = result.error || `Error HTTP ${response.status}`;
        console.error(`Heartbeat falló: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error sending heartbeat:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error de conexión';
      return { success: false, error: errorMsg };
    }
  };

  // Funciones para manejar video streaming
  const handlePlayVideo = async () => {
    if (!camera) return;
    
    setVideoLoading(true);
    setVideoError(null);
    
    try {
      console.log(`🎥 Iniciando stream de video para cámara ID: ${camera.id}`);
      
      // Enviar heartbeat inicial
      const heartbeatResult = await sendHeartbeat(camera.id);
      
      if (!heartbeatResult.success) {
        console.warn(`Heartbeat falló para cámara ${camera.id}: ${heartbeatResult.error}`);
        console.warn('Continuando con carga directa del video stream (modo compatibilidad)');
      }

      // Limpiar cualquier error previo y mostrar el video
      setVideoError(null);
      setVideoPlaying(true);
      
      // Establecer timeout para error si el video no carga en 15 segundos
      errorTimeoutRef.current = setTimeout(() => {
        setVideoError(`Error cargando video de cámara ${camera.id}`);
        setVideoLoading(false);
      }, 15000);
      
      // Iniciar heartbeat interval solo si el inicial fue exitoso
      if (heartbeatResult.success) {
        heartbeatIntervalRef.current = setInterval(async () => {
          const result = await sendHeartbeat(camera.id);
          if (!result.success) {
            console.warn(`Heartbeat periódico falló para cámara ${camera.id}: ${result.error}`);
          }
        }, 5000); // Cada 5 segundos como en streamingCameras.tsx
      } else {
        console.info('Heartbeat deshabilitado para esta cámara, usando modo compatibilidad');
      }
      
      console.log('✅ Video stream iniciado exitosamente');
      
    } catch (error: any) {
      console.error('❌ Error al iniciar video stream:', error);
      setVideoError(error.message || 'Error al conectar con el video');
      setVideoLoading(false);
    }
  };

  const handleStopVideo = () => {
    console.log('⏹️ Deteniendo video stream');
    setVideoPlaying(false);
    setVideoError(null);
    setVideoLoading(false);
    
    // Limpiar intervalos y timeouts
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camera) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/camaras/${camera.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...editForm,
          latitud: editForm.latitud ? parseFloat(editForm.latitud) : null,
          longitud: editForm.longitud ? parseFloat(editForm.longitud) : null,
          fuente_coord: 'Modificada por el usuario'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar cámara');
      }
      
      onCameraUpdated();
      
      // Solo guardar, NO cerrar el modal
      
    } catch (error: any) {
      console.error('Error updating camera:', error);
      alert(error.message || 'Error al actualizar cámara');
    } finally {
      setLoading(false);
    }
  };

  if (!camera) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
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
              <Dialog.Panel className="w-full transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all flex flex-col" style={{ maxWidth: 'calc(1280px + 200px)' }}>
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  ✏️ ID_Cruce: {(() => {
                    const currentCrossing = crossings.find(c => c.id === camera.id_cruce);
                    return currentCrossing?.id_cruce || camera.id_cruce;
                  })()} | Dirección: {(() => {
                    const currentCrossing = crossings.find(c => c.id === camera.id_cruce);
                    return currentCrossing?.direccion || 'N/A';
                  })()} | ID_Cámara: {camera.id} | Nomenclatura: {camera.nomenclatura_camara} | Origen Coordenadas: {camera.fuente_coord || 'N/A'} | Actualizado: {new Date(camera.last_update).toLocaleString('es-CO')}
                </Dialog.Title>

                <div className="flex flex-1">
                  <div className="w-[500px] flex-shrink-0">
                    <form onSubmit={handleSubmit}>
                      <div className="space-y-4">
                        {/* Fila 1: IP + Nomenclatura */}
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              IP *
                            </label>
                            <input
                              type="text"
                              required
                              value={editForm.ip}
                              onChange={(e) => setEditForm({...editForm, ip: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled={loading}
                            />
                          </div>
                          
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Nomenclatura
                            </label>
                            <input
                              type="text"
                              value={editForm.nomenclatura_camara}
                              onChange={(e) => setEditForm({...editForm, nomenclatura_camara: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled={loading}
                            />
                          </div>
                        </div>

                        {/* Fila 2: Latitud + Longitud */}
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Latitud
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={editForm.latitud}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                              title="Arrastra el marcador en el mapa para cambiar las coordenadas"
                            />
                          </div>

                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Longitud
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={editForm.longitud}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                              title="Arrastra el marcador en el mapa para cambiar las coordenadas"
                            />
                          </div>
                        </div>

                        {/* Fila 3: Estado + Comentario */}
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Estado
                            </label>
                            <select
                              value={editForm.estado}
                              onChange={(e) => setEditForm({...editForm, estado: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm hover:border-blue-400 cursor-pointer"
                              disabled={loading}
                            >
                              <option value="Activa">Activa</option>
                              <option value="No Alcanzable: IP no responde a conexión TCP">No Alcanzable</option>
                            </select>
                          </div>

                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Comentario
                            </label>
                            <input
                              type="text"
                              value={editForm.comentario}
                              onChange={(e) => setEditForm({...editForm, comentario: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled={loading}
                            />
                          </div>
                        </div>

                        {/* Fila 4: Control de Rotación */}
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Rotación de la cámara (°)
                            </label>
                            <div className="flex items-center space-x-3">
                              <input
                                type="range"
                                min="0"
                                max="360"
                                step="5"
                                value={editForm.rotacion}
                                onChange={(e) => {
                                  const newRotation = parseInt(e.target.value);
                                  console.log('✏️ Edit slider changed to:', newRotation);
                                  setEditForm({...editForm, rotacion: newRotation});
                                  console.log('✏️ Edit dispatching markerRotationChanged event with:', newRotation);
                                  window.dispatchEvent(new CustomEvent('markerRotationChanged', {
                                    detail: { rotation: newRotation }
                                  }));
                                }}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                disabled={loading}
                              />
                              <input
                                type="number"
                                min="0"
                                max="360"
                                step="5"
                                value={editForm.rotacion}
                                onChange={(e) => {
                                  const newRotation = Math.min(360, Math.max(0, parseInt(e.target.value) || 0));
                                  console.log('✏️🔢 Edit number input changed to:', newRotation);
                                  setEditForm({...editForm, rotacion: newRotation});
                                  console.log('✏️🔢 Edit dispatching markerRotationChanged event with:', newRotation);
                                  window.dispatchEvent(new CustomEvent('markerRotationChanged', {
                                    detail: { rotation: newRotation }
                                  }));
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                disabled={loading}
                              />
                              <span className="text-sm text-gray-500 min-w-[20px]">°</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reproductor de video */}
                      <div className="mt-6 mb-4">
                        <div 
                          className="border-2 border-solid border-gray-300 bg-black rounded-lg overflow-hidden"
                          style={{ width: '480px', height: '360px' }}
                        >
                          {videoError ? (
                            <div className="w-full h-full flex items-center justify-center text-center text-red-500 p-4">
                              <div>
                                <div className="text-4xl mb-2">❌</div>
                                <div className="text-sm">Error al cargar video</div>
                                <div className="text-xs text-red-400 mt-1">{videoError}</div>
                              </div>
                            </div>
                          ) : videoPlaying ? (
                            <img
                              src={`${backendUrl}/api/video_detector_feed/${camera?.id}`}
                              alt="Stream de video en vivo"
                              className="w-full h-full object-cover"
                              onLoad={() => {
                                console.log(`📹 Stream cargado exitosamente para cámara ${camera?.id}`);
                                setVideoLoading(false);
                                setVideoError(null);
                                // Limpiar error timeout ya que el video se cargó exitosamente
                                if (errorTimeoutRef.current) {
                                  clearTimeout(errorTimeoutRef.current);
                                  errorTimeoutRef.current = null;
                                }
                              }}
                              onError={(e) => {
                                console.error(`Error cargando stream para cámara ${camera?.id}:`, e);
                                console.error(`URL del stream: ${backendUrl}/api/video_detector_feed/${camera?.id}`);
                                // No establecer error inmediatamente - dejar que el timeout de 15 segundos lo maneje
                                setVideoLoading(false);
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-center text-gray-500">
                              <div>
                                <div className="text-4xl mb-2">📹</div>
                                <div className="text-sm">Reproductor de video</div>
                                <div className="text-xs text-gray-400 mt-1">480px × 360px (4:3)</div>
                                <div className="text-xs text-gray-400 mt-2">Presiona &quot;Play&quot; para iniciar</div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Controles de video */}
                        <div className="flex justify-center space-x-3 mt-3">
                          <button
                            type="button"
                            onClick={handlePlayVideo}
                            disabled={videoLoading || videoPlaying || loading}
                            className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                              videoPlaying 
                                ? 'bg-gray-500 cursor-not-allowed' 
                                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                            }`}
                          >
                            {videoLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Conectando...
                              </>
                            ) : (
                              <>
                                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                {videoPlaying ? 'Reproduciendo' : 'Play'}
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleStopVideo}
                            disabled={!videoPlaying || loading}
                            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            Stop
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-6">
                    {/* Botón Anterior (izquierda) */}
                    <button
                      type="button"
                      onClick={goToPreviousCamera}
                      disabled={loading || !getPreviousCamera()}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                      style={{ paddingTop: '6px', paddingBottom: '6px' }}
                    >
                      <ChevronLeftIcon className="h-3 w-3 mr-1" />
                      Anterior
                    </button>

                    {/* Botones centrales */}
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                        style={{ paddingTop: '6px', paddingBottom: '6px' }}
                        onClick={closeModal}
                        disabled={loading}
                      >
                        <XMarkIcon className="h-3 w-3 mr-1" />
                        Cancelar
                      </button>
                      
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        style={{ paddingTop: '6px', paddingBottom: '6px' }}
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <CheckIcon className="h-3 w-3 mr-1" />
                            Guardar
                          </>
                        )}
                      </button>
                    </div>

                    {/* Botón Siguiente (derecha) */}
                    <button
                      type="button"
                      onClick={goToNextCamera}
                      disabled={loading || !getNextCamera()}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                      style={{ paddingTop: '6px', paddingBottom: '6px' }}
                    >
                      Siguiente
                      <ChevronRightIcon className="h-3 w-3 ml-1" />
                    </button>
                      </div>
                    </form>
                  </div>
                  <div className="flex-1 p-4">
                    <div className="h-full min-h-[400px] border border-gray-200 rounded-lg overflow-hidden">
                      <Wrapper 
                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                        render={(status) => {
                          console.log('Google Maps API status:', status);
                          if (status === 'LOADING') return <div className="w-full h-full flex items-center justify-center bg-gray-100"><p>🗺️ Cargando Google Maps...</p></div>;
                          if (status === 'FAILURE') return <div className="w-full h-full flex items-center justify-center bg-red-100"><p>❌ Error al cargar Google Maps. Verifica el API Key.</p></div>;
                          return <div className="w-full h-full"></div>;
                        }}
                      >
                        <GoogleMapComponent
                          center={{
                            lat: camera?.latitud ? Number(camera.latitud) : 4.6097,
                            lng: camera?.longitud ? Number(camera.longitud) : -74.0817
                          }}
                          zoom={21}
                          rotation={editForm.rotacion}
                        />
                      </Wrapper>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Componente para la fila de tabla de cruce expandible
function ExpandableCrossingRow({
  crossing,
  expanded,
  onToggleExpand,
  onEditCrossing,
  onDeleteCrossing,
  onAddCamera,
  onEditCamera,
  onDeleteCamera,
  actionLoading,
  cameraUpdateTrigger
}: {
  crossing: Crossing;
  expanded: boolean;
  onToggleExpand: () => void;
  onEditCrossing: (crossing: Crossing) => void;
  onDeleteCrossing: (crossing: Crossing) => void;
  onAddCamera: (crossingId: number) => void;
  onEditCamera: (camera: Camera) => void;
  onDeleteCamera: (camera: Camera) => void;
  actionLoading: boolean;
  cameraUpdateTrigger?: number;
}) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loadingCameras, setLoadingCameras] = useState(false);

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

  useEffect(() => {
    if (expanded) {
      loadCameras();
    }
  }, [expanded]);

  // Escuchar actualizaciones de cámaras cuando cambie el trigger
  useEffect(() => {
    if (expanded && cameraUpdateTrigger !== undefined && cameraUpdateTrigger > 0) {
      loadCameras();
    }
  }, [cameraUpdateTrigger, expanded]);

  const loadCameras = async () => {
    setLoadingCameras(true);
    try {
      const response = await fetch(`${backendUrl}/api/admin/cruces/${crossing.id}/camaras`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setCameras(data.data || []);
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
    } finally {
      setLoadingCameras(false);
    }
  };

  const getStatusBadge = (estado: string) => {
    const colors: { [key: string]: string } = {
      'OK': 'green',
      'Por visitar': 'yellow',
      'Revisión Yunex': 'blue',
      'Fuera de servicio': 'red',
      'Activa': 'green',
      'Inactiva': 'red',
      'Mantenimiento': 'yellow'
    };
    
    const color = colors[estado] || 'gray';
    return <Badge color={color}>{estado}</Badge>;
  };

  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50">
          <td className="px-3 py-4 text-sm whitespace-nowrap">
            <div className="flex items-center">
              <button
                onClick={onToggleExpand}
                className="mr-3 p-1 hover:bg-gray-100 rounded"
              >
                {expanded ? (
                  <ChevronDownIcon className="h-5 w-5" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5" />
                )}
              </button>
              <MapPinIcon className="h-6 w-6 text-blue-500 mr-3" />
              <div>
                <button
                  onClick={() => onEditCrossing(crossing)}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors duration-200"
                  title="Editar cruce"
                >
                  {crossing.id_cruce}
                </button>
              </div>
            </div>
          </td>
          <td className="px-3 py-4 text-sm text-gray-900">
            <div className="truncate">{crossing.direccion}</div>
          </td>
          <td className="px-3 py-4 text-sm whitespace-nowrap">
            {getStatusBadge(crossing.estado)}
          </td>
          <td className="px-3 py-4 text-sm text-gray-900">
            <div className="max-w-xs truncate text-xs">
              {crossing.observaciones_vd || '-'}
            </div>
          </td>
          <td className="px-3 py-4 text-sm text-gray-900">
            <div className="max-w-xs truncate text-xs">
              {crossing.observaciones_etb || '-'}
            </div>
          </td>
          <td className="px-3 py-4 text-sm text-gray-900">
            <div className="text-sm">
              <div>IP: {crossing.ip}</div>
              <div className="text-gray-500">GW: {crossing.gateway}</div>
            </div>
          </td>
          <td className="px-3 py-4 text-sm whitespace-nowrap">
            <Badge color="blue">{crossing.total_camaras} cámaras</Badge>
          </td>
          <td className="px-3 py-4 text-sm font-medium whitespace-nowrap">
          <div className="flex space-x-2">
            <Button
              size="xs"
              variant="secondary"
              onClick={() => onEditCrossing(crossing)}
              disabled={actionLoading}
            >
              <PencilIcon className="h-4 w-4" />
            </Button>
            <Button
              size="xs"
              color="green"
              onClick={() => onAddCamera(crossing.id)}
              disabled={actionLoading}
              title="Agregar cámara al cruce"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={() => onDeleteCrossing(crossing)}
              disabled={actionLoading || crossing.total_camaras > 0}
              title={crossing.total_camaras > 0 ? "No se puede eliminar el cruce porque tiene cámaras asignadas" : "Eliminar cruce"}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
            </div>
          </td>
        </tr>

        {expanded && (
          <tr>
            <td colSpan={6} className="bg-white p-0">
            <div className="p-4 bg-gray-50 flex justify-right" style={{ minWidth: 'calc(100% + 150px)' }}>
              <div className="w-full">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-medium text-gray-900">
                  📹 Cámaras del Cruce
                </h4>
                {/* <Button
                  size="xs"
                  color="green"
                  onClick={() => onAddCamera(crossing.id)}
                  disabled={actionLoading}
                  title="Agregar nueva cámara a este cruce"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Agregar Cámara
                </Button> */}
              </div>

              {loadingCameras ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : cameras.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>ID</TableHeaderCell>
                      <TableHeaderCell>IP</TableHeaderCell>
                      <TableHeaderCell>Nomenclatura</TableHeaderCell>
                      <TableHeaderCell>Estado</TableHeaderCell>
                      <TableHeaderCell>Comentario</TableHeaderCell>
                      <TableHeaderCell>Fuente Coord.</TableHeaderCell>
                      <TableHeaderCell>Acciones</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cameras.map((camera) => (
                      <TableRow key={camera.id}>
                        <TableCell>
                          <button
                            onClick={() => onEditCamera(camera)}
                            className="text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                            title="Click para editar cámara"
                          >
                            {camera.id}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <VideoCameraIcon className="h-5 w-5 text-gray-400 mr-2" />
                            {camera.ip}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Text>{camera.nomenclatura_camara || 'Sin nomenclatura'}</Text>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(camera.estado)}
                        </TableCell>
                        <TableCell>
                          <div className="truncate text-sm" style={{ width: '200px' }}>
                            {camera.comentario || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {camera.fuente_coord ? (
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                camera.fuente_coord === 'Algoritmo Esteban' 
                                  ? 'bg-green-100 text-green-800' 
                                  : camera.fuente_coord === 'Aprox. Trigonometrica'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : camera.fuente_coord === 'Modificada por el usuario'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {camera.fuente_coord === 'Algoritmo Esteban' ? '🎯 Precisas' : 
                                 camera.fuente_coord === 'Aprox. Trigonometrica' ? '📐 Aprox.' : 
                                 camera.fuente_coord === 'Modificada por el usuario' ? '✏️ Usuario' :
                                 camera.fuente_coord}
                              </span>
                            ) : (
                              <span className="text-gray-400">No definida</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => onEditCamera(camera)}
                              disabled={actionLoading}
                            >
                              <PencilIcon className="h-3 w-3" />
                            </Button>
                            <Button
                              size="xs"
                              color="red"
                              onClick={() => onDeleteCamera(camera)}
                              disabled={actionLoading}
                            >
                              <TrashIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No hay cámaras registradas para este cruce
                </div>
              )}
              </div>
            </div>
            </td>
          </tr>
        )}
      </>
    );
}

// Componente principal
export default function CrossingAdministration() {
  const { user: currentUser } = useAuth();
  
  // Estados
  const [crossings, setCrossings] = useState<Crossing[]>([]);
  const [filteredCrossings, setFilteredCrossings] = useState<Crossing[]>([]);
  const [stats, setStats] = useState<CrossingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Estados para filtros
  const [filters, setFilters] = useState({
    id_cruce: '',
    direccion: '',
    estado: '',
    observaciones_vd: '',
    observaciones_etb: '',
    gateway: ''
  });
  
  // Estados para ordenamiento
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Crossing | null;
    direction: 'asc' | 'desc';
  }>({
    key: null,
    direction: 'asc'
  });
  
  // Estados para expansión de filas
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Estados para modales
  const [showCreateCrossingModal, setShowCreateCrossingModal] = useState(false);
  const [showEditCrossingModal, setShowEditCrossingModal] = useState(false);
  const [showCreateCameraModal, setShowCreateCameraModal] = useState(false);
  const [showEditCameraModal, setShowEditCameraModal] = useState(false);
  
  const [selectedCrossing, setSelectedCrossing] = useState<Crossing | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [selectedCrossingForCamera, setSelectedCrossingForCamera] = useState<number | null>(null);
  const [currentCameras, setCurrentCameras] = useState<Camera[]>([]);
  const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0);

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
        loadCrossings(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadCrossings = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/cruces`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar cruces');
      }
      
      const data = await response.json();
      setCrossings(data.data || []);
      setFilteredCrossings(data.data || []);
    } catch (error) {
      console.error('Error loading crossings:', error);
      throw error;
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/cruces/stats`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar estadísticas');
      }
      
      const data = await response.json();
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error loading stats:', error);
      throw error;
    }
  };

  // Funciones para filtrado y ordenamiento
  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    applyFiltersAndSort(crossings, newFilters, sortConfig);
  };

  const handleSort = (key: keyof Crossing) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    const newSortConfig = { key, direction };
    setSortConfig(newSortConfig);
    applyFiltersAndSort(crossings, filters, newSortConfig);
  };

  const applyFiltersAndSort = (
    data: Crossing[], 
    currentFilters: typeof filters, 
    currentSort: typeof sortConfig
  ) => {
    let result = [...data];

    // Aplicar filtros
    if (currentFilters.id_cruce) {
      result = result.filter(crossing => 
        crossing.id_cruce.toString().includes(currentFilters.id_cruce)
      );
    }
    if (currentFilters.direccion) {
      result = result.filter(crossing => 
        crossing.direccion.toLowerCase().includes(currentFilters.direccion.toLowerCase())
      );
    }
    if (currentFilters.estado) {
      result = result.filter(crossing => 
        crossing.estado.toLowerCase().includes(currentFilters.estado.toLowerCase())
      );
    }
    if (currentFilters.observaciones_vd) {
      result = result.filter(crossing => 
        (crossing.observaciones_vd || '').toLowerCase().includes(currentFilters.observaciones_vd.toLowerCase())
      );
    }
    if (currentFilters.observaciones_etb) {
      result = result.filter(crossing => 
        (crossing.observaciones_etb || '').toLowerCase().includes(currentFilters.observaciones_etb.toLowerCase())
      );
    }
    if (currentFilters.gateway) {
      result = result.filter(crossing => 
        crossing.gateway.toLowerCase().includes(currentFilters.gateway.toLowerCase())
      );
    }

    // Aplicar ordenamiento
    if (currentSort.key) {
      result.sort((a, b) => {
        const aValue = a[currentSort.key!];
        const bValue = b[currentSort.key!];
        
        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        return currentSort.direction === 'desc' ? -comparison : comparison;
      });
    }

    setFilteredCrossings(result);
  };

  // Efecto para aplicar filtros cuando cambian los cruces
  useEffect(() => {
    applyFiltersAndSort(crossings, filters, sortConfig);
  }, [crossings]);

  // Funciones para manejo de expansión
  const toggleRowExpansion = (crossingId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(crossingId)) {
      newExpanded.delete(crossingId);
    } else {
      newExpanded.add(crossingId);
    }
    setExpandedRows(newExpanded);
  };

  // Funciones para CRUD de cruces
  const handleDeleteCrossing = async (crossing: Crossing) => {
    if (crossing.total_camaras > 0) {
      alert('No se puede eliminar el cruce porque tiene cámaras asignadas. Elimine las cámaras primero.');
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar el cruce "${crossing.direccion}"?`)) {
      return;
    }
    
    setActionLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/cruces/${crossing.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al eliminar cruce');
      }
      
      alert('Cruce eliminado exitosamente');
      await loadData();
      
    } catch (error: any) {
      console.error('Error deleting crossing:', error);
      alert(error.message || 'Error al eliminar cruce');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditCrossingModal = (crossing: Crossing) => {
    setSelectedCrossing(crossing);
    setShowEditCrossingModal(true);
  };

  const closeEditCrossingModal = () => {
    setShowEditCrossingModal(false);
    setSelectedCrossing(null);
  };

  // Funciones para CRUD de cámaras
  const handleAddCamera = (crossingId: number) => {
    const crossing = crossings.find(c => c.id === crossingId);
    setSelectedCrossing(crossing || null);
    setSelectedCrossingForCamera(crossingId);
    setShowCreateCameraModal(true);
  };

  const handleDeleteCamera = async (camera: Camera) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la cámara "${camera.nomenclatura_camara || camera.ip}"?`)) {
      return;
    }
    
    setActionLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/camaras/${camera.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al eliminar cámara');
      }
      
      alert('Cámara eliminada exitosamente');
      await loadData();
      
    } catch (error: any) {
      console.error('Error deleting camera:', error);
      alert(error.message || 'Error al eliminar cámara');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditCameraModal = async (camera: Camera) => {
    setSelectedCamera(camera);
    setShowEditCameraModal(true);
    
    // Cargar las cámaras del cruce para la navegación
    try {
      const response = await fetch(`${backendUrl}/api/admin/cruces/${camera.id_cruce}/camaras`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentCameras(data.data || []);
      }
    } catch (error) {
      console.error('Error loading cameras for navigation:', error);
      setCurrentCameras([]);
    }
  };

  const handleEditNextCamera = (nextCamera: Camera) => {
    setSelectedCamera(nextCamera);
    // No cerramos el modal, solo cambiamos la cámara seleccionada
  };

  const closeEditCameraModal = () => {
    setShowEditCameraModal(false);
    setSelectedCamera(null);
    setCurrentCameras([]);
  };

  const closeCreateCameraModal = () => {
    setShowCreateCameraModal(false);
    setSelectedCrossingForCamera(null);
  };

  // Callbacks para refrescar datos
  const handleCrossingCreated = async () => {
    await loadData();
  };

  const handleCrossingUpdated = async () => {
    await loadData();
  };

  const handleCameraCreated = async () => {
    await loadData();
  };

  const handleCameraUpdated = async () => {
    // Solo actualizar las estadísticas sin recargar toda la lista de cruces
    try {
      await loadStats();
      
      // Incrementar el trigger para que los componentes hijos se actualicen
      setCameraUpdateTrigger(prev => prev + 1);
      
      // Si hay una cámara seleccionada, actualizar también la lista de cámaras actuales
      if (selectedCamera) {
        try {
          const response = await fetch(`${backendUrl}/api/admin/cruces/${selectedCamera.id_cruce}/camaras`, {
            headers: getAuthHeaders()
          });
          
          if (response.ok) {
            const data = await response.json();
            setCurrentCameras(data.data || []);
          }
        } catch (error) {
          console.error('Error updating current cameras list:', error);
        }
      }
      
    } catch (error) {
      console.error('Error updating camera data:', error);
    }
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
      <main className="p-4 md:p-6 mx-auto max-w-full h-screen overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <Title className="text-2xl font-bold text-gray-900 mb-2">
            🚦 Administración de video-detectores
          </Title>
          <Text className="text-gray-600">
            Gestiona los cruces viales y sus cámaras de video-detección
          </Text>
        </div>

        {/* Estadísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="flex items-center">
                <MapPinIcon className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <Text className="text-sm text-gray-600">Total Cruces</Text>
                  <Title className="text-2xl">{stats.total_cruces}</Title>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center">
                <VideoCameraIcon className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <Text className="text-sm text-gray-600">Total Cámaras</Text>
                  <Title className="text-2xl">{stats.total_camaras}</Title>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center">
                <SignalIcon className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <Text className="text-sm text-gray-600">Cruces Activos</Text>
                  <Title className="text-2xl">{stats.cruces_activos}</Title>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center">
                <GlobeAltIcon className="h-8 w-8 text-orange-600 mr-3" />
                <div>
                  <Text className="text-sm text-gray-600">Cámaras Activas</Text>
                  <Title className="text-2xl">{stats.camaras_activas}</Title>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Botón para crear cruce */}
        <div className="mb-6 flex justify-between items-center">
          <Button
            onClick={() => setShowCreateCrossingModal(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Agregar Cruce
          </Button>
          
          {(filters.id_cruce || filters.direccion || filters.estado || filters.observaciones_vd || filters.observaciones_etb || filters.gateway) && (
            <Button
              onClick={() => {
                setFilters({ id_cruce: '', direccion: '', estado: '', observaciones_vd: '', observaciones_etb: '', gateway: '' });
                applyFiltersAndSort(crossings, { id_cruce: '', direccion: '', estado: '', observaciones_vd: '', observaciones_etb: '', gateway: '' }, sortConfig);
              }}
              className="bg-gray-500 hover:bg-gray-600"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
          )}
        </div>

        {/* Tabla de cruces */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <Title>Cruces del Sistema</Title>
            <Text className="text-sm text-gray-500">
              Mostrando {filteredCrossings.length} de {crossings.length} cruces
            </Text>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse border border-gray-200">
              <colgroup>
                <col style={{ width: '100px' }} />
                <col style={{ width: '250px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '200px' }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="space-y-2">
                      <button 
                        className="flex items-center text-left font-medium cursor-pointer hover:text-blue-600 text-xs"
                        onClick={() => handleSort('id_cruce')}
                      >
                        ID Cruce
                        {sortConfig.key === 'id_cruce' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <input
                        type="text"
                        placeholder="Buscar ID..."
                        value={filters.id_cruce}
                        onChange={(e) => handleFilterChange('id_cruce', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="space-y-2">
                      <button 
                        className="flex items-center text-left font-medium cursor-pointer hover:text-blue-600 text-xs"
                        onClick={() => handleSort('direccion')}
                      >
                        Dirección
                        {sortConfig.key === 'direccion' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <input
                        type="text"
                        placeholder="Buscar dirección..."
                        value={filters.direccion}
                        onChange={(e) => handleFilterChange('direccion', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="space-y-2">
                      <button 
                        className="flex items-center text-left font-medium cursor-pointer hover:text-blue-600 text-xs"
                        onClick={() => handleSort('estado')}
                      >
                        Estado
                        {sortConfig.key === 'estado' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <input
                        type="text"
                        placeholder="Buscar estado..."
                        value={filters.estado}
                        onChange={(e) => handleFilterChange('estado', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="space-y-2">
                      <button 
                        className="flex items-center text-left font-medium cursor-pointer hover:text-blue-600 text-xs"
                        onClick={() => handleSort('observaciones_vd')}
                      >
                        Obs. VD
                        {sortConfig.key === 'observaciones_vd' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <input
                        type="text"
                        placeholder="Buscar obs. VD..."
                        value={filters.observaciones_vd}
                        onChange={(e) => handleFilterChange('observaciones_vd', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="space-y-2">
                      <button 
                        className="flex items-center text-left font-medium cursor-pointer hover:text-blue-600 text-xs"
                        onClick={() => handleSort('observaciones_etb')}
                      >
                        Obs. ETB
                        {sortConfig.key === 'observaciones_etb' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <input
                        type="text"
                        placeholder="Buscar obs. ETB..."
                        value={filters.observaciones_etb}
                        onChange={(e) => handleFilterChange('observaciones_etb', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="space-y-2">
                      <button 
                        className="flex items-center text-left font-medium cursor-pointer hover:text-blue-600 text-xs"
                        onClick={() => handleSort('gateway')}
                      >
                        Gateway
                        {sortConfig.key === 'gateway' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <input
                        type="text"
                        placeholder="Buscar gateway..."
                        value={filters.gateway}
                        onChange={(e) => handleFilterChange('gateway', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="space-y-2">
                      <button 
                        className="flex items-center text-left font-medium cursor-pointer hover:text-blue-600 text-xs"
                        onClick={() => handleSort('total_camaras')}
                      >
                        Cámaras
                        {sortConfig.key === 'total_camaras' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <div className="h-6"></div>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <div className="space-y-2">
                      <span className="font-medium text-xs">Acciones</span>
                      <div className="h-6"></div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCrossings.map((crossing) => (
                  <ExpandableCrossingRow
                    key={crossing.id}
                    crossing={crossing}
                    expanded={expandedRows.has(crossing.id)}
                    onToggleExpand={() => toggleRowExpansion(crossing.id)}
                    onEditCrossing={openEditCrossingModal}
                    onDeleteCrossing={handleDeleteCrossing}
                    onAddCamera={handleAddCamera}
                    onEditCamera={openEditCameraModal}
                    onDeleteCamera={handleDeleteCamera}
                    actionLoading={actionLoading}
                    cameraUpdateTrigger={cameraUpdateTrigger}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* Modales */}
      <CreateCrossingModal
        isOpen={showCreateCrossingModal}
        closeModal={() => setShowCreateCrossingModal(false)}
        onCrossingCreated={handleCrossingCreated}
      />

      <EditCrossingModal
        isOpen={showEditCrossingModal}
        closeModal={closeEditCrossingModal}
        crossing={selectedCrossing}
        onCrossingUpdated={handleCrossingUpdated}
      />

      <CreateCameraModal
        isOpen={showCreateCameraModal}
        closeModal={closeCreateCameraModal}
        crossingId={selectedCrossingForCamera}
        crossing={selectedCrossing}
        onCameraCreated={handleCameraCreated}
      />

      <EditCameraModal
        isOpen={showEditCameraModal}
        closeModal={closeEditCameraModal}
        camera={selectedCamera}
        onCameraUpdated={handleCameraUpdated}
        cameras={currentCameras}
        onEditNextCamera={handleEditNextCamera}
        crossings={crossings}
      />
    </>
  );
}