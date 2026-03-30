'use client';

import React, { createContext, useState, ReactNode, useContext } from 'react';

export interface FutureAlertFocus {
  alertId: string;
  center: {
    lat: number;
    lng: number;
  };
  paths: [number, number][][];
  roadName?: string;
  peakTimeslot?: string;
  severityScore?: number;
  affectedCount?: number;
  predictedLevel?: number;
}

interface CoordinateContextProps {
  lat: number;
  lng: number;
  vistaTrafico: string;
  futureAlertFocus: FutureAlertFocus | null;
  setCoordinates: (lat: number, lng: number, vistaTrafico: string) => void;
  setFutureAlertFocus: (focus: FutureAlertFocus | null) => void;
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
  const [futureAlertFocus, setFutureAlertFocus] =
    useState<FutureAlertFocus | null>(null);
  //const [vistaTrafico, setVistaTrafico] = useState("CONGESTION");

  const setCoordinatesHandler = (lat: number, lng: number, vistaTrafico: string) => {
    setCoordinates({ lat, lng });
    setVistaTrafico(vistaTrafico);
    setFutureAlertFocus(null);
    console.log( `Vista Trafico - ${vistaTrafico} - Latitud: ${lat} - Longitud: ${lng}`);
    
  };

  const setFutureAlertFocusHandler = (focus: FutureAlertFocus | null) => {
    setFutureAlertFocus(focus);

    if (focus) {
      setCoordinates({ lat: focus.center.lat, lng: focus.center.lng });
    }
  };

  return (
    <CoordinateContext.Provider value={{ lat: coordinates.lat, lng: coordinates.lng, vistaTrafico, futureAlertFocus, setCoordinates: setCoordinatesHandler, setFutureAlertFocus: setFutureAlertFocusHandler }}>
     {children}
    </CoordinateContext.Provider>

    

  );
};
