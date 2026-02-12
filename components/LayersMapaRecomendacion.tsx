'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@tremor/react';
import { ButtonPermissionWrapper } from './auth/usePermissions';

interface LayersmapaRecomendacionProps {
    onChange: (name: string, checked: boolean) => void;
    alertasOrigen: number;
    alertasDestino: number;
    alertasBorrar: number;
    activePanel: string;
    onPanelChange: (panelName: string) => void;
    originsCount?: number;
  }

export default function LayersMapaRecomendacion({onChange,alertasOrigen,alertasDestino,alertasBorrar,activePanel,onPanelChange,originsCount = 0}:LayersmapaRecomendacionProps) {

    const isVisible = activePanel === "RECOMENDACIONES";

    const toggleVisibility = () => {
      onPanelChange("RECOMENDACIONES");
    };

    const [categories, setCategories] = useState<{ [key: string]: boolean }>({
        origen: false,
        destino: false,
        borrar: false,
    });

    // Ref para evitar que el useEffect interfiera con los clicks del usuario
    const isUserInteraction = React.useRef(false);

    // Layer id patterns by category
    const layerSelector: { [key: string]: RegExp } = {       
        alertasOrigen: /origen/,
        alertasDestino: /destino/,
        borrar: /borrar/,
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
        // Validar que haya origins antes de permitir activar destino
        if (name === 'destino' && originsCount === 0) {
          alert("Por favor seleccione primero los origenes.");
          return;
        }

        // Marcar que es una interacción del usuario
        isUserInteraction.current = true;

        const newValue = !categories[name];

        // Determinar el nuevo estado
        let updatedCategories: { [key: string]: boolean };

        if (newValue === true) {
          // Si se está activando, solo este botón debe estar activo
          updatedCategories = {
            origen: name === 'origen',
            destino: name === 'destino',
            borrar: name === 'borrar',
          };

          // Notificar que los otros botones se desactivaron
          if (onChange) {
            const otherButtons = ['origen', 'destino', 'borrar'].filter(btn => btn !== name);
            otherButtons.forEach(btn => onChange(btn, false));
            onChange(name, true);
          }
        } else {
          // Si se está desactivando, simplemente cambiar el valor
          updatedCategories = { ...categories, [name]: newValue };
          if (onChange) {
            onChange(name, false);
          }
        }

        // Actualizar el estado
        setCategories(updatedCategories);

        // Resetear el flag después de un momento
        setTimeout(() => {
          isUserInteraction.current = false;
        }, 100);
      };

    useEffect(() => {
        const filter = (layerId: string) => getLayerFilter(categories, layerId);
    }, [categories]);

    // Sincronizar el estado interno con las props solo cuando TODAS las alertas sean 0
    // Y no sea una interacción del usuario (para evitar conflictos)
    useEffect(() => {
        if (!isUserInteraction.current && alertasOrigen === 0 && alertasDestino === 0 && alertasBorrar === 0) {
            setCategories({
                origen: false,
                destino: false,
                borrar: false,
            });
        }
    }, [alertasOrigen, alertasDestino, alertasBorrar]);

    return (
        <>
      
  
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
                <img src="/icons/btnRecomendacion.png" alt="Recomendaciones" style={{ height: '30px' }} />
              </>
            ) : (
              <>
                <img src="/icons/btnRecomendacionOff.png" alt="Recomendaciones" style={{ height: '30px' }} />
              </>
            )} 
          </Button>
        </div>

        <div
          style={{
            position: 'absolute',
                top: '-125px',
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
            >Modelo de recomendación
          </Button>
          }
          

          {/* Contenedor de botones, visible solo si `isVisible` es true */}
          {isVisible && (
            <div style={{ marginRight: '10px',  gap: '5px', padding: '5px'}}>
              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="RECOMENDACIONES"
                requiredButtonId="ORIGEN"
              >
                <Button
                  style={{ backgroundColor: categories.origen ? '#dad604ff' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px' }}
                  onClick={() => toggleLayer('origen')}
                  title="origen"
                >
                  <img src="/icons/origen.png" alt="origen" style={{ width: '30px', height: '30px' }} />
                </Button>
              </ButtonPermissionWrapper>           

              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="RECOMENDACIONES"
                requiredButtonId="DESTINO"
              >
                <Button
                  style={{
                    backgroundColor: originsCount === 0
                      ? 'lightslategray'
                      : (categories.destino ? '#ffb97e' : 'lightslategray'),
                    border: 'none',
                    marginRight: '5px',
                    gap: '5px',
                    padding: '5px',
                    cursor: originsCount === 0 ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => toggleLayer('destino')}
                  title="destino"
                >
                  <img src="/icons/destino.png" alt="destino" style={{ width: '30px', height: '30px' }} />
                </Button>
              </ButtonPermissionWrapper>

              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="RECOMENDACIONES"
                requiredButtonId="BORRAR"
              >
                <Button
                  style={{ backgroundColor: categories.borrar ? '#ca8832ff' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px' }}
                  onClick={() => toggleLayer('borrar')}
                  title="borrar"
                >
                  <img src="/icons/borrar.png" alt="borrar" style={{ width: '30px', height: '30px' }} />
                </Button>
              </ButtonPermissionWrapper>      

            </div>
          )}

        </div>
      </>
    );
}
