'use client';

  import { Table,TableHead,TableRow,TableHeaderCell,TableBody,TableCell,Text,Button } from '@tremor/react';
  import React, { useState, useContext  } from 'react';
  import { useRouter } from 'next/navigation'; // Importa useRouter desde next/router
  import SymbolState from './symbolState';
  import LoadingScreen from '../components/loadingScreen'; 
  import { useCoordinates  } from '../components/coordinateContext';

  
  interface AlertsTableProps {
    datos: string[];
    tipoTrafico: string;
    //login: string | null;
  }
  
    const AlertsTable: React.FC<AlertsTableProps> = ({datos,tipoTrafico}) => {

    const router = useRouter(); // Objeto de enrutamiento

    const [loadingPage, setLoadingPage] = useState(false); 

    const { setCoordinates } = useCoordinates();

    const handleViewClick = (lat:number, lng:number) => {

      let tipo = "oprimir"+tipoTrafico;
      setCoordinates(lat, lng, tipo);
      console.log(`Vista Trafico - ${tipo} - Latitud: ${lat} - Longitud: ${lng}`);
      
    };

    return (
      
      <Table>
        {loadingPage && <LoadingScreen />}  
        <TableHead>
          <TableRow>
          <TableHeaderCell>Estado</TableHeaderCell>
          <TableHeaderCell>Dirección</TableHeaderCell>
          {
            tipoTrafico === 'P1' ? (
              <TableHeaderCell>Gravedad</TableHeaderCell>
            ) : tipoTrafico === 'CONGESTION' ? (
              <TableHeaderCell>Indice</TableHeaderCell>
            ) :  tipoTrafico === 'JAMS' ? (
              <TableHeaderCell>Delay</TableHeaderCell>
            ) :  tipoTrafico === 'INTELIGENTES' ? (
              <TableHeaderCell>Afectados</TableHeaderCell>
            ) : 
            <TableHeaderCell>Likes</TableHeaderCell>
          }
          {
           tipoTrafico === 'INTELIGENTES' ? (
              <TableHeaderCell>Nivel</TableHeaderCell>
            ) : null
          }
          <TableHeaderCell>Hora</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {datos.map((dato,i) => (
            <TableRow key={i}>

              <TableCell>
                <SymbolState state={dato[9]} /> 
              </TableCell>
              <TableCell>{dato[1]}</TableCell>
              <TableCell>{dato[2]}</TableCell>
              {
                tipoTrafico === 'INTELIGENTES' ? (
                    <TableCell>{dato[0]}</TableCell>
                  ) : null
              }
              <TableCell>{dato[6]}</TableCell>

              <TableCell> 
              
              {parseFloat(dato[7]) !== 0 && parseFloat(dato[8]) !== 0 && (
                  <Button 
                    style={{ backgroundColor: '#232f3d', color: 'white' , border: 'none' }} 
                    onClick={() => handleViewClick( parseFloat(dato[7]), parseFloat(dato[8]) )}
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
  