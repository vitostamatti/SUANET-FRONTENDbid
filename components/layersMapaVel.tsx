'use client';

import React, { useState, useEffect } from 'react';
import './LayersMapaVel.css';

interface LayersMapaVelProps {
    onChange: (name: string, on: boolean) => void;
    opcOtic: number;
    opcCongestion: number;
    vistaTrafico: string;
    opcVel: string;
}

export default function LayersMapaVel({ onChange, opcOtic, opcCongestion, vistaTrafico, opcVel }: LayersMapaVelProps) {

    //console.log(vistaTrafico +"  "+ opcVel);

    const getInitialLayer = () => {
        if (vistaTrafico === "oprimirJAMS" || vistaTrafico === "oprimirCONGESTION") {
            return vistaTrafico;
        }
        return opcVel || 'P1';
    };
    
    const [selectedLayer, setSelectedLayer] = useState<string>(getInitialLayer());
    const [isAutoChange, setIsAutoChange] = useState(true);
    

    // Definición base de capas
    const baseLayers: { [key: string]: RegExp } = {
        P1: /waze/,
    };

    // Añadir capas condicionales
    const availableLayers = { ...baseLayers };


    if (opcOtic === 1) {
        availableLayers['JAMS'] = /JAMS/;
    }

    if (opcCongestion === 1) {
        availableLayers['CONGESTION'] = /CONGESTION/;
    }


    // Efecto para cambios en las props (selección automática)
    useEffect(() => {
       
        // Mapeo de valores de vistaTrafico a las opciones del dropdown
        const layerMapping: { [key: string]: string } = {
            'oprimirCONGESTION': 'CONGESTION',
            'oprimirJAMS': 'JAMS',
            //'oprimirP1': 'P1'
            'oprimirINTELIGENTES': 'INTELIGENTES'
        };

        // Determinar la capa seleccionada basada en vistaTrafico
        const selected = layerMapping[vistaTrafico] || 'P1';
        
        // Verificar que la capa seleccionada esté disponible
        if (availableLayers[selected]) {
            setSelectedLayer(selected);
            onChange?.(selected, true);
        } else {
            setSelectedLayer('P1');
            onChange?.('P1', true);
        }
    }, [vistaTrafico, opcOtic, opcCongestion]);

    

    useEffect(() => {
        if (onChange) {
            onChange(selectedLayer, true);
        }
    }, [selectedLayer, onChange]);

     const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const userSelectedLayer = event.target.value;
        setIsAutoChange(false);
        setSelectedLayer(userSelectedLayer);
        onChange?.(userSelectedLayer, true);
    };

  
    const getLayerDisplayName = (name: string) => {
        switch (name) 
        {
            case 'JAMS':
                return 'JAMS WAZE';
            case 'CONGESTION':
                return 'INDICE DE CONGESTION';
            case 'P1':
                return 'TRÁFICO GOOGLE MAPS';
            default:
                return name;
        }
    };

    return (
        <div className="white-text-labelVel">
            <div className="dropdown-container">
                <p>Vista de tráfico</p>
                <select value={selectedLayer} onChange={handleChange}>
                    {Object.keys(availableLayers).map((name) => (
                        <option key={name} value={name}>
                            {getLayerDisplayName(name)}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}