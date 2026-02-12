import React from 'react';

export default function SymbolState ({ state }: { state: string }) {
  let color = '';
  let icon = '';

  //console.log(state);

  switch (state) {
    case 'HERIDO':
      color = 'red';
      icon = '🚨'; 
      break;    
    case 'MUERTO':
      color = 'gray';
      icon = '💀';
      break;
    case 'CONGESTION':
      color = 'red';
      icon = '❌';
      break;
    case 'ALERTS_RELIABILITY_GT_8':
      color = 'yellow';
      icon = '💥';
      break;
    case 'DIM_JAMS_LEVEL_5':
      color = 'yellow';
      icon = '⚠️';
      break;
     case 'INTELIGENTES':
      color = 'yellow';
      icon = '💡';
      break;
    default:
      color = 'yellow';
      icon = '⚠️';
      break;
  }

  return (
    <span style={{ color }}>
      {icon}
    </span>
  );
};

