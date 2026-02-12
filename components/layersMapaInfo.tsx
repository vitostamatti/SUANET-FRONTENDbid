'use client';

import React, { useState, useEffect } from 'react';
import './LayersMapaInfo.css';
import { Button } from '@tremor/react';
import Chart from './d3Charts';
//import Streaming from './streamingCameras';
import { ButtonPermissionWrapper } from './auth/usePermissions';

interface LayersmapaInfoProps {
    valor1: string;
    valor2: string;
    valor4: number;
    valor5: number;
    valor6: string;
    idStreaming: number;
    fuenteStreaming: string;
}

export default function LayersMapaInfo({valor1,valor2,valor4,valor5,valor6,idStreaming,fuenteStreaming}: LayersmapaInfoProps) {

  const [graficaTipo, setGrafica] = useState(0);  
  
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const handleClickTacometros = () => {
    setGrafica(1);
  };

  const handleClickLeyenda = () => {
    setGrafica(2);
  };

  const handleClickStreaming = () => {
    setGrafica(3);
  };

  const handleClickLeyendaLluvias = () => {
    setGrafica(4);
  };


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
            Información
          </>
        ) : (
          <>
            <img src="/icons/infoBtn.png" alt="Alertas" style={{ height: '30px' }} />
          </>
        )} 
      </Button>

        {/* Contenedor de botones, visible solo si `isVisible` es true */}
        {isVisible && (
          <div>

            <div> 
                <ButtonPermissionWrapper
                  requiredModuleId="HOME"
                  requiredControlId="INFO"
                  requiredButtonId="STREAMING_INFO"
                >
                  <Button 
                      style={{ backgroundColor: graficaTipo==3 ? 'white' : 'lightslategray', border: 'none', marginRight: '5px' }}
                      onClick={() => handleClickStreaming()}
                      title="Streaming"
                  >
                      <img src="/icons/streaming.png" alt="Streaming" style={{ width: '30px', height: '30px' }} />
                  </Button>    
                </ButtonPermissionWrapper>

                <ButtonPermissionWrapper
                  requiredModuleId="HOME"
                  requiredControlId="INFO"
                  requiredButtonId="ANALISIS_TIEMPOS_RESPUESTA"
                >
                  <Button 
                      style={{ backgroundColor: graficaTipo==1 ? 'white' : 'lightslategray', border: 'none', marginRight: '5px' }}
                      onClick={() => handleClickTacometros()}
                      title="Análisis de tiempos de respuesta"
                  >
                      <img src="/icons/tacometro.png" alt="Tacometro" style={{ width: '30px', height: '30px' }} />
                  </Button>
                </ButtonPermissionWrapper>

                <ButtonPermissionWrapper
                  requiredModuleId="HOME"
                  requiredControlId="INFO"
                  requiredButtonId="LEYENDA"
                >
                  <Button 
                      style={{ backgroundColor: graficaTipo==2 ? 'white' : 'lightslategray', border: 'none', marginRight: '5px' }}
                      onClick={() => handleClickLeyenda()}
                      title="Leyenda"
                  >
                      <img src="/icons/leyenda.png" alt="Leyenda" style={{ width: '30px', height: '30px' }} />
                  </Button>
                </ButtonPermissionWrapper>

                <ButtonPermissionWrapper
                  requiredModuleId="HOME"
                  requiredControlId="INFO"
                  requiredButtonId="LLUVIAS"
                >
                  <Button 
                      style={{ backgroundColor: graficaTipo==4 ? 'white' : 'lightslategray', border: 'none', marginRight: '5px' }}
                      onClick={() => handleClickLeyendaLluvias()}
                      title="Lluvias"
                  >
                      <img src="/icons/leyenda2.png" alt="Leyenda" style={{ width: '30px', height: '30px' }} />
                  </Button>   
                </ButtonPermissionWrapper>
                        
            </div>


          
            {
              graficaTipo == 1 ?
              <>
                <div className="control-panel-d3">      
                    <div>
                        <Chart valor1={valor1} valor2={valor2} valor4={valor4} valor5={valor5} valor6={valor6} />
                    </div>
                </div>
              </>
              :
              <>
              </>
            }
            {
              graficaTipo == 2 ?
              <>
                <div className="control-panel-d3">      
                    <div style={{ width: '320px', left: '0px', top: '0px', position: 'relative' }}>
                      <img src="/leyenda.png" alt="Leyenda" style={{ width: '300px', height: '305x' }}/>
                    </div>
                </div>
              </>
              :
              <>
              </>
            }
            {
              graficaTipo == 3 ?
              <>
                <div className="control-panel-d3">                       
                     {
                        //<Streaming idStreaming={idStreaming} fuenteStreaming={fuenteStreaming} />
                     } 
                </div>
              </>
              :
              <>
              </>
            }
            {
              graficaTipo == 4 ?
              <>
                <div className="control-panel-d3">      
                    <div style={{ width: '320px', left: '0px', top: '0px', position: 'relative' }}>
                      <img src="/leyenda2.png" alt="LeyendaLluvias" style={{ width: '300px', height: '305x' }}/>
                    </div>
                </div>
              </>
              :
              <>
              </>
            }

         </div>


        )}

      </div>
    </>
  );
}

