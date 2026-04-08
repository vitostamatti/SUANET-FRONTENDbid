"use client";

import React, { useEffect, useState } from "react";
import "./LayersMapaInfo.css";
import { Button } from "@tremor/react";
import Chart from "./d3Charts";
//import Streaming from './streamingCameras';
import { ButtonPermissionWrapper } from "./auth/usePermissions";

interface LayersmapaInfoProps {
  valor1: string;
  valor2: string;
  valor4: number;
  valor5: number;
  valor6: string;
  idStreaming: number;
  fuenteStreaming: string;
  opcVel: string;
  isPredictionWidgetVisible: boolean;
  onTogglePredictionWidget: () => void;
}

export default function LayersMapaInfo({
  valor1,
  valor2,
  valor4,
  valor5,
  valor6,
  idStreaming,
  fuenteStreaming,
  opcVel,
  isPredictionWidgetVisible,
  onTogglePredictionWidget,
}: LayersmapaInfoProps) {
  const [graficaTipo, setGrafica] = useState(0);
  const isPredictionLayerSelected =
    opcVel === "PREDICCIONES_CONGESTION" ||
    opcVel === "oprimirPREDICCIONES_CONGESTION";

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isPredictionLayerSelected) {
      if (graficaTipo === 5) {
        setGrafica(0);
      }
      return;
    }

    if (isPredictionWidgetVisible && !isVisible) {
      setIsVisible(true);
    }

    if (isPredictionWidgetVisible && graficaTipo !== 5) {
      setGrafica(5);
      return;
    }

    if (!isPredictionWidgetVisible && graficaTipo === 5) {
      setGrafica(0);
    }
  }, [
    isPredictionLayerSelected,
    isPredictionWidgetVisible,
    graficaTipo,
    isVisible,
  ]);

  const toggleVisibility = () => {
    const shouldOpen = !isVisible;

    if (!shouldOpen) {
      setGrafica(0);
      if (isPredictionWidgetVisible) {
        onTogglePredictionWidget();
      }
    }

    setIsVisible(shouldOpen);
  };

  const hidePredictionPanel = () => {
    if (isPredictionWidgetVisible) {
      onTogglePredictionWidget();
    }
  };

  const handleClickTacometros = () => {
    hidePredictionPanel();
    setGrafica(1);
  };

  const handleClickLeyenda = () => {
    hidePredictionPanel();
    setGrafica(2);
  };

  const handleClickStreaming = () => {
    hidePredictionPanel();
    setGrafica(3);
  };

  const handleClickLeyendaLluvias = () => {
    hidePredictionPanel();
    setGrafica(4);
  };

  const handleClickPredictionWidget = () => {
    if (graficaTipo === 5) {
      setGrafica(0);
      if (isPredictionWidgetVisible) {
        onTogglePredictionWidget();
      }
      return;
    }

    setGrafica(5);
    if (!isPredictionWidgetVisible) {
      onTogglePredictionWidget();
    }
  };

  return (
    <>
      {/*
      <div className="white-text-labelAlertas">
        <p>Alertas</p>
      </div>
      */}

      <div
        style={{
          position: "absolute",
          top: "25px",
          right: "5px",
          zIndex: 10,
          color: "white",
          borderRadius: "5px",
          fontSize: "14px",
          flexDirection: "column",
          display: "inline-flex",
          alignItems: "flex-end",
          maxWidth: "calc(100vw - 10px)",
          justifyContent: "flex-start",
          cursor: "pointer",
        }}
      >
        {/* Botón para desplegar/ocultar */}
        <Button
          onClick={toggleVisibility}
          style={{
            backgroundColor: "#1F223E",
            border: "none",
            color: "white",
            borderRadius: "5px",
            width: isVisible ? "100%" : "auto",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {isVisible ? (
            <>Información</>
          ) : (
            <>
              <img
                src="/icons/infoBtn.png"
                alt="Alertas"
                style={{ height: "30px" }}
              />
            </>
          )}
        </Button>

        {/* Contenedor de botones, visible solo si `isVisible` es true */}
        {isVisible && (
          <div>
            <div
              style={{
                display: "flex",
                flexWrap: "nowrap",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="INFO"
                requiredButtonId="STREAMING_INFO"
              >
                <Button
                  style={{
                    backgroundColor:
                      graficaTipo == 3 ? "white" : "lightslategray",
                    border: "none",
                    marginRight: "5px",
                  }}
                  onClick={() => handleClickStreaming()}
                  title="Streaming"
                >
                  <img
                    src="/icons/streaming.png"
                    alt="Streaming"
                    style={{ width: "30px", height: "30px" }}
                  />
                </Button>
              </ButtonPermissionWrapper>

              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="INFO"
                requiredButtonId="ANALISIS_TIEMPOS_RESPUESTA"
              >
                <Button
                  style={{
                    backgroundColor:
                      graficaTipo == 1 ? "white" : "lightslategray",
                    border: "none",
                    marginRight: "5px",
                  }}
                  onClick={() => handleClickTacometros()}
                  title="Análisis de tiempos de respuesta"
                >
                  <img
                    src="/icons/tacometro.png"
                    alt="Tacometro"
                    style={{ width: "30px", height: "30px" }}
                  />
                </Button>
              </ButtonPermissionWrapper>

              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="INFO"
                requiredButtonId="LEYENDA"
              >
                <Button
                  style={{
                    backgroundColor:
                      graficaTipo == 2 ? "white" : "lightslategray",
                    border: "none",
                    marginRight: "5px",
                  }}
                  onClick={() => handleClickLeyenda()}
                  title="Leyenda"
                >
                  <img
                    src="/icons/leyenda.png"
                    alt="Leyenda"
                    style={{ width: "30px", height: "30px" }}
                  />
                </Button>
              </ButtonPermissionWrapper>

              <ButtonPermissionWrapper
                requiredModuleId="HOME"
                requiredControlId="INFO"
                requiredButtonId="LLUVIAS"
              >
                <Button
                  style={{
                    backgroundColor:
                      graficaTipo == 4 ? "white" : "lightslategray",
                    border: "none",
                    marginRight: "5px",
                  }}
                  onClick={() => handleClickLeyendaLluvias()}
                  title="Lluvias"
                >
                  <img
                    src="/icons/leyenda2.png"
                    alt="Leyenda"
                    style={{ width: "30px", height: "30px" }}
                  />
                </Button>
              </ButtonPermissionWrapper>

              {isPredictionLayerSelected && (
                <Button
                  style={{
                    backgroundColor:
                      graficaTipo == 5 ? "white" : "lightslategray",
                    border: "none",
                    marginRight: "5px",
                  }}
                  onClick={handleClickPredictionWidget}
                  title={
                    isPredictionWidgetVisible
                      ? "Ocultar panel de predicciones"
                      : "Mostrar panel de predicciones"
                  }
                >
                  <img
                    src="/icons/periodo.png"
                    alt="Predicciones"
                    style={{ width: "30px", height: "30px" }}
                  />
                </Button>
              )}
            </div>

            {graficaTipo == 1 ? (
              <>
                <div className="control-panel-d3">
                  <div>
                    <Chart
                      valor1={valor1}
                      valor2={valor2}
                      valor4={valor4}
                      valor5={valor5}
                      valor6={valor6}
                    />
                  </div>
                </div>
              </>
            ) : (
              <></>
            )}
            {graficaTipo == 2 ? (
              <>
                <div className="control-panel-d3">
                  <div
                    style={{
                      width: "320px",
                      left: "0px",
                      top: "0px",
                      position: "relative",
                    }}
                  >
                    <img
                      src="/leyenda.png"
                      alt="Leyenda"
                      style={{ width: "300px", height: "305x" }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <></>
            )}
            {graficaTipo == 3 ? (
              <>
                <div className="control-panel-d3">
                  {
                    //<Streaming idStreaming={idStreaming} fuenteStreaming={fuenteStreaming} />
                  }
                </div>
              </>
            ) : (
              <></>
            )}
            {graficaTipo == 4 ? (
              <>
                <div className="control-panel-d3">
                  <div
                    style={{
                      width: "320px",
                      left: "0px",
                      top: "0px",
                      position: "relative",
                    }}
                  >
                    <img
                      src="/leyenda2.png"
                      alt="LeyendaLluvias"
                      style={{ width: "300px", height: "305x" }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <></>
            )}
          </div>
        )}
      </div>
    </>
  );
}
