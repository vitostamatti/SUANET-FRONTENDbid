import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

// Mock data para testing
const mockCamera = {
  id: 1,
  id_cruce: 1001,
  ip: "10.100.39.5",
  nomenclatura_camara: "Cámara Norte",
  latitud: 4.65195008,
  longitud: -74.06177500,
  comentario: "Cámara principal del cruce",
  estado: "Activa",
  last_update: new Date().toISOString()
};

// Componente de Google Maps simplificado
function GoogleMapComponent({ center, zoom }) {
  return (
    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl mb-2">🗺️</div>
        <div className="text-sm">Google Maps</div>
        <div className="text-xs text-gray-500">
          Lat: {center.lat.toFixed(6)}<br/>
          Lng: {center.lng.toFixed(6)}
        </div>
      </div>
    </div>
  );
}

// Modal de prueba
function TestEditCameraModal({ isOpen, closeModal, camera }) {
  const [editForm, setEditForm] = useState({
    ip: camera?.ip || '',
    nomenclatura_camara: camera?.nomenclatura_camara || '',
    latitud: camera?.latitud?.toString() || '',
    longitud: camera?.longitud?.toString() || '',
    comentario: camera?.comentario || '',
    estado: camera?.estado || ''
  });

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
                  ✏️ Editar Cámara: {camera.nomenclatura_camara || camera.ip} - Actualizado: {new Date(camera.last_update).toLocaleString('es-CO')}
                </Dialog.Title>

                <div className="flex flex-1">
                  <div className="w-[500px] flex-shrink-0">
                    <form>
                      <div className="space-y-4">
                        {/* Fila 1: IP + Nomenclatura */}
                        <div className="flex space-x-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              IP *
                            </label>
                            <input
                              type="text"
                              value={editForm.ip}
                              onChange={(e) => setEditForm({...editForm, ip: e.target.value})}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              style={{ width: '130px' }}
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Nomenclatura
                            </label>
                            <input
                              type="text"
                              value={editForm.nomenclatura_camara}
                              onChange={(e) => setEditForm({...editForm, nomenclatura_camara: e.target.value})}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              style={{ width: '130px' }}
                            />
                          </div>
                        </div>

                        {/* Fila 2: Latitud + Longitud */}
                        <div className="flex space-x-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Latitud
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={editForm.latitud}
                              readOnly
                              className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                              style={{ width: '130px' }}
                              title="Arrastra el marcador en el mapa para cambiar las coordenadas"
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
                              readOnly
                              className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                              style={{ width: '130px' }}
                              title="Arrastra el marcador en el mapa para cambiar las coordenadas"
                            />
                          </div>
                        </div>

                        {/* Fila 3: Estado + Comentario */}
                        <div className="flex space-x-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Estado
                            </label>
                            <select
                              value={editForm.estado}
                              onChange={(e) => setEditForm({...editForm, estado: e.target.value})}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100 cursor-not-allowed text-xs"
                              style={{ width: '130px' }}
                              disabled={true}
                            >
                              <option value="Activa">Activa</option>
                              <option value="Inactiva">Inactiva</option>
                              <option value="No Alcanzable: IP no responde a conexión TCP">No Alcanzable</option>
                              <option value="Mantenimiento">Mantenimiento</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Comentario
                            </label>
                            <input
                              type="text"
                              value={editForm.comentario}
                              onChange={(e) => setEditForm({...editForm, comentario: e.target.value})}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              style={{ width: '130px' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Espacio reservado para reproductor de video */}
                      <div className="mt-6 mb-6">
                        <div 
                          className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg flex items-center justify-center"
                          style={{ width: '640px', height: '480px' }}
                        >
                          <div className="text-center text-gray-500">
                            <div className="text-4xl mb-2">📹</div>
                            <div className="text-sm">Espacio reservado para reproductor de video</div>
                            <div className="text-xs text-gray-400 mt-1">640px × 480px</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          type="button"
                          className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                          style={{ paddingTop: '6px', paddingBottom: '6px' }}
                          onClick={closeModal}
                        >
                          <XMarkIcon className="h-3 w-3 mr-1" />
                          Cancelar
                        </button>
                        
                        <button
                          type="submit"
                          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                          style={{ paddingTop: '6px', paddingBottom: '6px' }}
                        >
                          <CheckIcon className="h-3 w-3 mr-1" />
                          Guardar y Cerrar
                        </button>
                        
                        <button
                          type="button"
                          className="inline-flex justify-center rounded-md border border-transparent bg-green-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                          style={{ paddingTop: '6px', paddingBottom: '6px' }}
                        >
                          <CheckIcon className="h-3 w-3 mr-1" />
                          Guardar y Editar siguiente
                        </button>
                      </div>
                    </form>
                  </div>
                  <div className="p-4" style={{ width: 'calc(100% - 50px)' }}>
                    <div className="h-full min-h-[400px] border border-gray-200 rounded-lg overflow-hidden">
                      <GoogleMapComponent
                        center={{
                          lat: camera?.latitud ? Number(camera.latitud) : 4.6097,
                          lng: camera?.longitud ? Number(camera.longitud) : -74.0817
                        }}
                        zoom={21}
                      />
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

// Página de prueba
export default function TestModalPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Test Modal de Edición de Cámara</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          Abrir Modal de Prueba
        </button>
      </div>

      <TestEditCameraModal
        isOpen={showModal}
        closeModal={() => setShowModal(false)}
        camera={mockCamera}
      />
    </div>
  );
}