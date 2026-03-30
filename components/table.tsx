'use client';

import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Button,
} from '@tremor/react';
import React from 'react';
import SymbolState from './symbolState';
import { useCoordinates } from '../components/coordinateContext';

interface FutureAlertRow {
  alertId: string;
  roadName: string;
  severityScore: number;
  predictedLevel: number;
  affectedCount: number;
  peakTimeslot: string;
  centerLat: number;
  centerLng: number;
  paths: [number, number][][];
}

interface AlertsTableProps {
  datos: any[];
  tipoTrafico: string;
}

const AlertsTable: React.FC<AlertsTableProps> = ({ datos, tipoTrafico }) => {
  const { setCoordinates, setFutureAlertFocus } = useCoordinates();

  const handleViewClick = (lat: number, lng: number) => {
    const tipo = `oprimir${tipoTrafico}`;
    setCoordinates(lat, lng, tipo);
    console.log(`Vista Trafico - ${tipo} - Latitud: ${lat} - Longitud: ${lng}`);
  };

  const handleFutureAlertViewClick = (dato: FutureAlertRow) => {
    const hasCoordinates =
      Number.isFinite(dato.centerLat) &&
      Number.isFinite(dato.centerLng) &&
      Array.isArray(dato.paths) &&
      dato.paths.length > 0;

    if (!hasCoordinates) {
      return;
    }

    setFutureAlertFocus({
      alertId: dato.alertId,
      center: {
        lat: dato.centerLat,
        lng: dato.centerLng,
      },
      paths: dato.paths,
      roadName: dato.roadName,
      peakTimeslot: dato.peakTimeslot,
      severityScore: dato.severityScore,
      affectedCount: dato.affectedCount,
      predictedLevel: dato.predictedLevel,
    });
  };

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Estado</TableHeaderCell>
          <TableHeaderCell>Direccion</TableHeaderCell>
          {tipoTrafico === 'P1' ? (
            <TableHeaderCell>Gravedad</TableHeaderCell>
          ) : tipoTrafico === 'CONGESTION' ? (
            <TableHeaderCell>Indice</TableHeaderCell>
          ) : tipoTrafico === 'JAMS' ? (
            <TableHeaderCell>Delay</TableHeaderCell>
          ) : tipoTrafico === 'INTELIGENTES' ? (
            <TableHeaderCell>Afectados</TableHeaderCell>
          ) : tipoTrafico === 'FUTURE_ALERTS' ? (
            <TableHeaderCell>Severidad</TableHeaderCell>
          ) : (
            <TableHeaderCell>Likes</TableHeaderCell>
          )}
          {tipoTrafico === 'INTELIGENTES' ? (
            <TableHeaderCell>Nivel</TableHeaderCell>
          ) : tipoTrafico === 'FUTURE_ALERTS' ? (
            <TableHeaderCell>Afectados</TableHeaderCell>
          ) : null}
          <TableHeaderCell>Hora</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {tipoTrafico === 'FUTURE_ALERTS'
          ? datos.map((dato: FutureAlertRow, i) => {
              const hasCoordinates =
                Number.isFinite(dato.centerLat) &&
                Number.isFinite(dato.centerLng) &&
                Array.isArray(dato.paths) &&
                dato.paths.length > 0;

              return (
                <TableRow key={i}>
                  <TableCell>
                    <SymbolState
                      state={dato.predictedLevel >= 3 ? 'ALERTA' : 'NORMAL'}
                    />
                  </TableCell>
                  <TableCell>{dato.roadName}</TableCell>
                  <TableCell>{dato.severityScore.toFixed(2)}</TableCell>
                  <TableCell>{dato.affectedCount}</TableCell>
                  <TableCell>{dato.peakTimeslot?.slice(11, 16) || '-'}</TableCell>
                  <TableCell>
                    {hasCoordinates && (
                      <Button
                        style={{
                          backgroundColor: '#232f3d',
                          color: 'white',
                          border: 'none',
                        }}
                        onClick={() => handleFutureAlertViewClick(dato)}
                      >
                        Ver
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          : datos.map((dato, i) => (
              <TableRow key={i}>
                <TableCell>
                  <SymbolState state={dato[9]} />
                </TableCell>
                <TableCell>{dato[1]}</TableCell>
                <TableCell>{dato[2]}</TableCell>
                {tipoTrafico === 'INTELIGENTES' ? (
                  <TableCell>{dato[0]}</TableCell>
                ) : null}
                <TableCell>{dato[6]}</TableCell>

                <TableCell>
                  {parseFloat(dato[7]) !== 0 && parseFloat(dato[8]) !== 0 && (
                    <Button
                      style={{
                        backgroundColor: '#232f3d',
                        color: 'white',
                        border: 'none',
                      }}
                      onClick={() =>
                        handleViewClick(parseFloat(dato[7]), parseFloat(dato[8]))
                      }
                    >
                      Ver
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
};

export default AlertsTable;
  