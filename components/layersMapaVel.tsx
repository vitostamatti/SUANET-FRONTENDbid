"use client";

import React, { useState, useEffect, useMemo } from "react";
import "./LayersMapaVel.css";

interface LayersMapaVelProps {
  onChange: (name: string, on: boolean) => void;
  opcOtic: number;
  opcCongestion: number;
  opcPredictions: number;
  vistaTrafico: string;
  opcVel: string;
}

export default function LayersMapaVel({
  onChange,
  opcOtic,
  opcCongestion,
  opcPredictions,
  vistaTrafico,
  opcVel,
}: LayersMapaVelProps) {
  //console.log(vistaTrafico +"  "+ opcVel);

  const getInitialLayer = () => {
    if (
      vistaTrafico === "oprimirJAMS" ||
      vistaTrafico === "oprimirCONGESTION"
    ) {
      return vistaTrafico;
    }
    return opcVel || "P1";
  };

  const [selectedLayer, setSelectedLayer] = useState<string>(getInitialLayer());

  const availableLayers = useMemo(() => {
    const baseLayers: { [key: string]: RegExp } = {
      P1: /waze/,
    };

    if (opcOtic === 1) {
      baseLayers["JAMS"] = /JAMS/;
    }

    if (opcCongestion === 1) {
      baseLayers["CONGESTION"] = /CONGESTION/;
    }

    if (opcPredictions === 1) {
      baseLayers["PREDICCIONES_CONGESTION"] = /PREDICCIONES_CONGESTION/;
    }

    return baseLayers;
  }, [opcOtic, opcCongestion, opcPredictions]);

  // Keep dropdown selection stable and only sync with external overrides when valid.
  useEffect(() => {
    const layerMapping: { [key: string]: string } = {
      oprimirCONGESTION: "CONGESTION",
      oprimirJAMS: "JAMS",
      oprimirPREDICCIONES_CONGESTION: "PREDICCIONES_CONGESTION",
      oprimirINTELIGENTES: "INTELIGENTES",
    };

    const mappedFromVista = layerMapping[vistaTrafico];

    const nextLayer =
      (mappedFromVista &&
        availableLayers[mappedFromVista] &&
        mappedFromVista) ||
      (opcVel && availableLayers[opcVel] && opcVel) ||
      (availableLayers[selectedLayer] && selectedLayer) ||
      "P1";

    if (nextLayer !== selectedLayer) {
      setSelectedLayer(nextLayer);
      onChange?.(nextLayer, true);
    }
  }, [availableLayers, onChange, opcVel, selectedLayer, vistaTrafico]);

  useEffect(() => {
    if (onChange) {
      onChange(selectedLayer, true);
    }
  }, [selectedLayer, onChange]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const userSelectedLayer = event.target.value;
    setSelectedLayer(userSelectedLayer);
    onChange?.(userSelectedLayer, true);
  };

  const getLayerDisplayName = (name: string) => {
    switch (name) {
      case "JAMS":
        return "JAMS WAZE";
      case "CONGESTION":
        return "INDICE DE CONGESTION";
      case "P1":
        return "TRÁFICO GOOGLE MAPS";
      case "PREDICCIONES_CONGESTION":
        return "PREDICCIONES DE CONGESTIÓN";
      default:
        return name;
    }
  };

  return (
    <div className="white-text-labelVel">
      <div className="dropdown-container">
        <p>Traffic View</p>
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
