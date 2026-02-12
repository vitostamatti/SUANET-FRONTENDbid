'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@tremor/react';
import { ButtonPermissionWrapper } from './auth/usePermissions';

interface LayersmapaAlertasProps {
  onChange: (name: string, checked: boolean) => void;
  alertasWaze: number;
  alertasIrregularidades: number;
  alertasPrioridad: number;
  alertasInteligentes: number;
  opcListaAlertas: string;
  activePanel: string;
  onPanelChange: (panelName: string) => void;
}

export default function LayersMapaAlertas({onChange,alertasWaze,alertasIrregularidades,alertasPrioridad,alertasInteligentes,opcListaAlertas,activePanel,onPanelChange}: LayersmapaAlertasProps) {
  
  const isVisible = activePanel === "ALERTAS";

  const toggleVisibility = () => {
    onPanelChange("ALERTAS");
  };

  
  const [categories, setCategories] = useState<{ [key: string]: boolean }>({
    incidentes: false,
    waze: false,
    irregularidad: false,
    prioridad: true,
    inteligentes: false,
  });

  useEffect(() => {
    const newCategories = { ...categories };
    
    // Resetear todos los toggles primero
    Object.keys(newCategories).forEach(key => {
      newCategories[key] = false;
    });

    // Activar el toggle correspondiente
    switch(opcListaAlertas) {
      case "oprimirP1":
        newCategories.incidentes = true;
        break;
      case "oprimirWAZE":
        newCategories.waze = true;
        break;
      case "oprimirINTELIGENTES":
        newCategories.inteligentes = true;
        break;
      /*  
      case "oprimirInteligentes":
        newCategories.inteligentes = true;
        break;
      case "oprimirIrregularidad":
        newCategories.irregularidad = true;
        break;
      case "oprimirPrioridad":
        newCategories.prioridad = true;
        break;     
      */
      default:
        // Por defecto mantener prioridad e inteligentes activas
        newCategories.prioridad = true;
        newCategories.inteligentes = true;
    }

    setCategories(newCategories);
    
    // Notificar los cambios
    Object.keys(newCategories).forEach(key => {
      if (onChange) {
        onChange(key, newCategories[key]);
      }
    });

  }, [opcListaAlertas]);


  // Layer id patterns by category
  const layerSelector: { [key: string]: RegExp } = {
    incidentes: /incidentes/,
    ...(alertasWaze === 1 && { waze: /waze/ }),
    ...(alertasIrregularidades === 1 && { irregularidad: /irregularidad/ }),
    ...(alertasPrioridad === 1 && { prioridad: /prioridad/ }),
    ...(alertasInteligentes === 1 && { inteligentes: /inteligentes/ }),
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
        <p>Alertas</p>
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
            <img src="/icons/btnAlerta.png" alt="Alertas" style={{ height: '30px' }} />
          </>
        ) : (
          <>
            <img src="/icons/btnAlertaOff.png" alt="Alertas" style={{ height: '30px' }} />
          </>
        )} 
      </Button>

    </div>

    <div
      style={{
         position: 'absolute',
            top: '25px',
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
          >Botones de Alertas
        </Button>
        }

        {/* Contenedor de botones, visible solo si `isVisible` es true */}
        {isVisible && (
          <div style={{ marginRight: '10px',  gap: '5px', padding: '5px'}}>
            <ButtonPermissionWrapper
              requiredModuleId="HOME"
              requiredControlId="ALERTAS"
              requiredButtonId="PRIORIDAD"
            >
              <Button
                style={{ backgroundColor: categories.prioridad ? 'white' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px'  }}
                onClick={() => toggleLayer('prioridad')}
                title="Prioridad"
              >
                <img src="/icons/prioridad.png" alt="Prioridad" style={{ width: '30px', height: '30px' }} />
              </Button>
            </ButtonPermissionWrapper>

            <ButtonPermissionWrapper
              requiredModuleId="HOME"
              requiredControlId="ALERTAS"
              requiredButtonId="INTELIGENTES"
            >
              <Button
                style={{ backgroundColor: categories.inteligentes ? '#fb97ff' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px'  }}
                onClick={() => toggleLayer('inteligentes')}
                title="Inteligentes"
              >
                <img src="/icons/inteligentes.png" alt="Inteligentes" style={{ width: '30px', height: '30px' }} />
              </Button>
            </ButtonPermissionWrapper>

            <ButtonPermissionWrapper
              requiredModuleId="HOME"
              requiredControlId="ALERTAS"
              requiredButtonId="INCIDENTES"
            >
              <Button
                style={{ backgroundColor: categories.incidentes ? '#9b3042' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px'  }}
                onClick={() => toggleLayer('incidentes')}
                title="Incidentes"
              >
                <img src="/icons/incidentes.png" alt="Incidentes" style={{ width: '30px', height: '30px' }} />
              </Button>
            </ButtonPermissionWrapper>

            <ButtonPermissionWrapper
              requiredModuleId="HOME"
              requiredControlId="ALERTAS"
              requiredButtonId="WAZE"
            >
              <Button
                style={{ backgroundColor: categories.waze ? '#0e808b' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px'  }}
                onClick={() => toggleLayer('waze')}
                title="Waze"
              >
                <img src="/icons/waze.png" alt="Waze" style={{ width: '30px', height: '30px' }} />
              </Button>
            </ButtonPermissionWrapper>

            <ButtonPermissionWrapper
              requiredModuleId="HOME"
              requiredControlId="ALERTAS"
              requiredButtonId="IRREGULARIDADES"
            >
              <Button
                style={{ backgroundColor: categories.irregularidad ? '#00c4da' : 'lightslategray', border: 'none', marginRight: '5px',  gap: '5px', padding: '5px' }}
                onClick={() => toggleLayer('irregularidad')}
                title="Irregularidades"
              >
                <img src="/icons/irregularidades.png" alt="Irregularidades" style={{ width: '30px', height: '30px' }} />
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

