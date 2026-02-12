'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@tremor/react';
import { ButtonPermissionWrapper } from './auth/usePermissions';

interface LayersmapaCondicionesProps {
    onChange: (name: string, checked: boolean) => void;
    alertasLluvias: number;
    alertasPMT: number;
    alertasDesvios: number;
    activePanel: string;
    onPanelChange: (panelName: string) => void;
  }

export default function LayersMapaCondiciones({onChange,alertasLluvias,alertasPMT,alertasDesvios,activePanel,onPanelChange}:LayersmapaCondicionesProps) {

    const isVisible = activePanel === "CONDICIONES";

    const toggleVisibility = () => {
      onPanelChange("CONDICIONES");
    };

    const [categories, setCategories] = useState<{ [key: string]: boolean }>({
        lluvias: false,
        pmt: false,
        desvios: false,
    });

    // Layer id patterns by category
    const layerSelector: { [key: string]: RegExp } = {        

        //...(alertasSalvavidas === 1 && { salvavidas: /salvavidas/ }),
        //...(alertasCGT === 1 && { cgt: /cgt/ }),
        //...(alertasSemaforos === 1 && { semaforos: /semaforos/ })

        alertasDesvios: /pmt/,
        streaming: /desvios/,
        lluvias: /lluvias/  
                
    };

    function getLayerFilter(categories: { [key: string]: boolean }, layerId: string) {
        for (const key in categories) {
            if (categories[key] && layerSelector[key].test(layerId)) {
                return true;
            }
        }
        return false;
    }

    const toggleLayer = (name: string) => {
    setCategories((prevCategories) => ({
      ...prevCategories,
      [name]: !prevCategories[name],
    }));
  };

  const applyLayers = () => {
    Object.keys(categories).forEach(key => {
      if (onChange) {
        onChange(key, categories[key]);
      }
    });
  };

    useEffect(() => {
        const filter = (layerId: string) => getLayerFilter(categories, layerId);
    }, [categories]);

    return (
        <>
        {
          /*
            <div className="white-text-labelAlertas">
              <p>Activos</p>
            </div>
          */
        }
  
        <div
          style={{
            position: 'absolute',
            top: '25px',
            right: '5px',
            zIndex: 10,
            color: 'white',
            borderRadius: '5px',
            fontSize: '14px',
            flexDirection: 'column',
            display: 'inline-flex',
            justifyContent: 'flex-start',
            cursor: 'pointer',
          }}
        >
           {/* Botón para desplegar/ocultar */}
            <Button
            onClick={toggleVisibility}
            style={{
               backgroundColor: '#1F223E',
              border: 'none',
              color: 'white',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
            >
              {isVisible ? (
              <>
                <img src="/icons/btnCondicion.png" alt="Condiciones" style={{ height: '30px' }} />
              </>
            ) : (
              <>
                <img src="/icons/btnCondicionOff.png" alt="Condiciones" style={{ height: '30px' }} />
              </>
            )} 
          </Button>
        </div>

        <div
          style={{
            position: 'absolute',
                top: '-75px',
                right: '80px',
                zIndex: 10,
                color: 'white',
                borderRadius: '5px',
                fontSize: '14px',
                flexDirection: 'column',
                display: 'inline-flex',
                justifyContent: 'flex-start',
                cursor: 'pointer',
          }}
        >
          {/* Botón para desplegar/ocultar */}
                  
          {isVisible && <Button
            onClick={toggleVisibility}
            style={{
              backgroundColor: '#1F223E',
              border: 'none',
              color: 'white',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
            >Condiciones en Vía
          </Button>
          }
          

          {/* Contenedor de botones, visible solo si `isVisible` es true */}
          {isVisible && (
            <div style={{ marginRight: '10px',  gap: '5px', padding: '5px'}}>
              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="CONDICIONES_EN_VIA"
                requiredButtonId="LLUVIAS"
              >
                <Button
                  style={{ backgroundColor: categories.lluvias ? '#da046d' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px' }}
                  onClick={() => toggleLayer('lluvias')}
                  title="lluvias"
                >
                  <img src="/icons/lluvia.png" alt="lluvia" style={{ width: '30px', height: '30px' }} />
                </Button>
              </ButtonPermissionWrapper>           

              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="CONDICIONES_EN_VIA"
                requiredButtonId="PMT"
              >
                <Button
                  style={{ backgroundColor: categories.pmt ? '#f25244' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px' }}
                  onClick={() => toggleLayer('pmt')}
                  title="PMT"
                >
                  <img src="/icons/pmt.png" alt="PMT" style={{ width: '30px', height: '30px' }} />
                </Button>
              </ButtonPermissionWrapper>

              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="CONDICIONES_EN_VIA"
                requiredButtonId="DESVIOS"
              >
                <Button
                  style={{ backgroundColor: categories.desvios ? '#7865ff' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px' }}
                  onClick={() => toggleLayer('desvios')}
                  title="Desvios"
                >
                  <img src="/icons/desvios.png" alt="Desvios" style={{ width: '30px', height: '30px' }} />
                </Button>
              </ButtonPermissionWrapper>

              <Button
                onClick={applyLayers}
                style={{
                  backgroundColor: '#1F223E',
                  border: '1px solid gray',
                  color: 'white',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  padding: '5px 25px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
                title="Aplicar filtros seleccionados"
              >
                Aplicar
              </Button>
            </div>
          )}

        </div>
      </>
    );
}
