'use client';

import React, { createContext, useState, ReactNode, useContext } from 'react';

interface CoordinateContextProps {
  lat: number;
  lng: number;
  vistaTrafico: string;
  setCoordinates: (lat: number, lng: number, vistaTrafico: string) => void;
}

const CoordinateContext = createContext<CoordinateContextProps | undefined>(undefined);

export const useCoordinates = () => {
  const context = useContext(CoordinateContext);
  if (!context) {
    throw new Error('useCoordinates must be used within a CoordinateProvider');
  }
  return context;
};

export const CoordinateProvider = ({ children }: { children: ReactNode }) => {

  //colocar coordenadas inciales del mapa
  const [coordinates, setCoordinates] = useState({ lat: 4.6573506, lng: -74.0909468 });

  //colocar vistaTrafico dropdown inicial
  const [vistaTrafico, setVistaTrafico] = useState("P1");
  //const [vistaTrafico, setVistaTrafico] = useState("CONGESTION");

  const setCoordinatesHandler = (lat: number, lng: number, vistaTrafico: string) => {
    setCoordinates({ lat, lng });
    setVistaTrafico(vistaTrafico);
    console.log( `Vista Trafico - ${vistaTrafico} - Latitud: ${lat} - Longitud: ${lng}`);
    
  };

  return (
    <CoordinateContext.Provider value={{ lat: coordinates.lat, lng: coordinates.lng, vistaTrafico, setCoordinates: setCoordinatesHandler }}>
     {children}
    </CoordinateContext.Provider>

    

  );
};
