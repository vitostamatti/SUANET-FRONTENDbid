'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@tremor/react';
import { ButtonPermissionWrapper } from './auth/usePermissions';

interface LayersmapaActivosProps {
    onChange: (name: string, checked: boolean) => void;
    alertasSalvavidas: number;
    alertasCGT: number;
    alertasSemaforos: number;
    alertasStreaming: number;
    activePanel: string;
    onPanelChange: (panelName: string) => void;
  }

export default function LayersMapaActivos({onChange,alertasSalvavidas,alertasCGT,alertasSemaforos,alertasStreaming,activePanel,onPanelChange}:LayersmapaActivosProps) {

    const isVisible = activePanel === "ACTIVOS";

    const toggleVisibility = () => {
      onPanelChange("ACTIVOS");
    };

    const [categories, setCategories] = useState<{ [key: string]: boolean }>({
        salvavidas: false,
        camaras_CGT: false,
        semaforos: false,
        streaming: false,
        streamingSemaforos: false
    });

    // Layer id patterns by category
    const layerSelector: { [key: string]: RegExp } = {        

        //...(alertasSalvavidas === 1 && { salvavidas: /salvavidas/ }),
        //...(alertasCGT === 1 && { cgt: /cgt/ }),
        //...(alertasSemaforos === 1 && { semaforos: /semaforos/ })

        salvavidas: /salvavidas/,
        camaras_CGT: /camaras_CGT/,
        semaforos: /semaforos/,
        streaming: /streaming/
                
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
                <img src="/icons/btnActivos.png" alt="Alertas" style={{ height: '30px' }} />
              </>
              ) : (
                <>
                  <img src="/icons/btnActivosOff.png" alt="Alertas" style={{ height: '30px' }} />
                </>
              )} 
            </Button>
        </div>

        <div
          style={{
            position: 'absolute',
            top: '-25px',
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
              >Botones de Activos
            </Button>
      }

              {/* Contenedor de botones, visible solo si `isVisible` es true */}
              {isVisible && (
                <div style={{ marginRight: '10px',  gap: '5px', padding: '5px'}}>

                  <ButtonPermissionWrapper
                    requiredModuleId="HOME"
                    requiredControlId="ACTIVOS"
                    requiredButtonId="STREAMING"
                  >
                    <Button
                      style={{ backgroundColor: categories.streaming ? '#b8a616' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px' }}
                      onClick={() => toggleLayer('streaming')}
                      title="streaming"
                    >
                      <img src="/icons/streaming.png" alt="streaming" style={{ width: '30px', height: '30px' }} />
                    </Button>
                  </ButtonPermissionWrapper>     

                  <ButtonPermissionWrapper
                    requiredModuleId="HOME"
                    requiredControlId="ACTIVOS"
                    requiredButtonId="CAMARAS_CGT"
                  >
                    <Button
                      style={{ backgroundColor: categories.camaras_CGT ? '#eff5eb' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px' }}
                      onClick={() => toggleLayer('camaras_CGT')}
                      title="camaras_CGT"
                    >
                      <img src="/icons/camaras_CGT.png" alt="camaras_CGT" style={{ width: '30px', height: '30px' }} />
                    </Button>
                  </ButtonPermissionWrapper>

                  <ButtonPermissionWrapper
                    requiredModuleId="HOME"
                    requiredControlId="ACTIVOS"
                    requiredButtonId="SALVAVIDAS"
                  >
                    <Button
                      style={{ backgroundColor: categories.salvavidas ? '#7b234b' : 'lightslategray', border: 'none', marginRight: '5px' ,  gap: '5px', padding: '5px'}}
                      onClick={() => toggleLayer('salvavidas')}
                      title="salvavidas"
                    >
                      <img src="/icons/salvavidas.png" alt="salvavidas" style={{ width: '30px', height: '30px' }} />
                    </Button>
                  </ButtonPermissionWrapper>

                  <ButtonPermissionWrapper
                    requiredModuleId="HOME"
                    requiredControlId="ACTIVOS"
                    requiredButtonId="SEMAFOROS"
                  >
                    <Button
                      style={{ backgroundColor: categories.semaforos ? '#a0a0a0' : 'lightslategray', border: 'none', marginRight: '5px' ,  gap: '5px', padding: '5px'}}
                      onClick={() => toggleLayer('semaforos')}
                      title="semaforos"
                    >
                      <img src="/icons/semaforos.png" alt="semaforos" style={{ width: '30px', height: '30px' }} />
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
