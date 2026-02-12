import React, { useState } from 'react';
import Chart from './d3Charts';
import LayersmapaAlertas from './layersMapaAlertas';
import LayersmapaActivos from './LayersMapaActivos';
import LayersmapaCondiciones from './LayersMapaCondiciones';
import LayersmapaRecomendaciones from './LayersMapaRecomendacion';
import LayersmapaInfo from './layersMapaInfo';
import LayersmapaVel from './layersMapaVel';
import { Select, SelectItem, Button } from '@tremor/react';
import { ControlPermissionWrapper } from '../components/auth/usePermissions';

interface ControlPanelProps {
  alertasDesvios: number;
  alertasPMT: number;
  alertasWaze: number;
  alertasIrregularidades: number;
  alertasPrioridad: number;
  alertasInteligentes: number;
  alertasSalvavidas: number;
  alertasCGT: number;
  alertasSemaforos: number;
  alertasStreaming: number;
  alertasLluvias: number;
  alertasOrigen: number;
  alertasDestino: number;
  alertasBorrar: number;
  opcOtic: number;
  opcCongestion: number;
  onChangeAlertas: (name: string, on: boolean) => void;
  onChangeActivos: (name: string, on: boolean) => void;
  onChangeCondiciones: (name: string, on: boolean) => void;
  onChangeRecomendaciones: (name: string, on: boolean) => void;
  onChangeVel: (name: string, on: boolean) => void;
  tiempoHistorico: string;
  tiempo: string;
  numIncidentesLastDay: number;
  vistaTrafico: string;
  dataIDstreaming: number;
  fuenteStreaming: string;
  opcListaAlertas: string;
  opcVel: string;
  originsCount?: number;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  alertasDesvios,
  alertasPMT,
  alertasWaze,
  alertasIrregularidades,
  alertasPrioridad,
  alertasInteligentes,
  alertasSalvavidas,
  alertasCGT,
  alertasSemaforos,
  alertasStreaming,
  alertasLluvias,
  alertasOrigen,
  alertasDestino,
  alertasBorrar,
  opcOtic,
  opcCongestion,
  onChangeAlertas,
  onChangeActivos,
  onChangeCondiciones,
  onChangeRecomendaciones,
  onChangeVel,
  tiempoHistorico,
  tiempo,
  numIncidentesLastDay,
  vistaTrafico,
  dataIDstreaming,
  fuenteStreaming,
  opcListaAlertas,
  opcVel,
  originsCount = 0
}) => {

  const [dataValue, setDataValue] = useState<number>(1);

  const [activePanel, setActivePanel] = useState<string>("");

   const handlePanelChange = (panelName: string) => {
    setActivePanel(prev => (prev === panelName ? "" : panelName));
  };


  const handleLayerChangeVel = (name: string, checked: boolean) => {
    if (onChangeVel) {
      onChangeVel(name, checked);
    }
  };


  return (
  <>
   {/* Alertas */}
    <ControlPermissionWrapper requiredModuleId="HOME" requiredControlId="ALERTAS">
      <div className="control-buttonsAlertas">
        <LayersmapaAlertas
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          onChange={onChangeAlertas}
          alertasWaze={alertasWaze}
          alertasIrregularidades={alertasIrregularidades}
          alertasPrioridad={alertasPrioridad}
          alertasInteligentes={alertasInteligentes}
          opcListaAlertas={opcListaAlertas}
        />
      </div>
    </ControlPermissionWrapper>

    {/* Activos */}
    <ControlPermissionWrapper requiredModuleId="HOME" requiredControlId="ACTIVOS">
      <div className="control-buttonsActivos">
       <LayersmapaActivos
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          onChange={onChangeActivos}  // Usa el real en lugar del console.log
          alertasSalvavidas={alertasSalvavidas}
          alertasCGT={alertasCGT}
          alertasSemaforos={alertasSemaforos}
          alertasStreaming={alertasStreaming}
        />
      </div>
    </ControlPermissionWrapper>

    {/* Condiciones */}
    <ControlPermissionWrapper requiredModuleId="HOME" requiredControlId="CONDICIONES_EN_VIA">
      <div className="control-buttonsCondiciones">
        <LayersmapaCondiciones
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          onChange={onChangeCondiciones}
          alertasLluvias={alertasLluvias}
          alertasPMT={alertasPMT}
          alertasDesvios={alertasDesvios}
        />
      </div>
    </ControlPermissionWrapper>
 
    {/* Modulo de recomendaciones */}
    <ControlPermissionWrapper requiredModuleId="HOME" requiredControlId="RECOMENDACIONES">
      <div className="control-buttonsRecomendaciones">
        <LayersmapaRecomendaciones
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          onChange={onChangeRecomendaciones}
          alertasOrigen={alertasOrigen}
          alertasDestino={alertasDestino}
          alertasBorrar={alertasBorrar}
          originsCount={originsCount}
        />
      </div>
    </ControlPermissionWrapper>
 
    {/* Control: Vista de Tráfico */}
    <ControlPermissionWrapper requiredModuleId="HOME" requiredControlId="VISTA_DE_TRAFICO">
      <div className="control-buttonsVel">
        <div>
            <LayersmapaVel onChange={handleLayerChangeVel} opcOtic={opcOtic} opcCongestion={opcCongestion} vistaTrafico={vistaTrafico} opcVel={opcVel}/>
        </div>
      </div>
    </ControlPermissionWrapper>

    {/* Control: Info */}
    <ControlPermissionWrapper requiredModuleId="HOME" requiredControlId="INFO">
      <div className="control-buttonsInfo">
        <div>
            <LayersmapaInfo valor1={tiempoHistorico} valor2={tiempo} valor4={numIncidentesLastDay} valor5={0} valor6={"0"} idStreaming={dataIDstreaming} fuenteStreaming={fuenteStreaming}/>
        </div>
      </div>
    </ControlPermissionWrapper>
  </>

  );
};

export default ControlPanel;
