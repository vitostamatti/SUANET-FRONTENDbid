
import * as d3 from 'd3';
import React, { useState, useEffect } from 'react';

interface D3ChartsProps {
  valor1: string;
  valor2: string;
  //valor3: number;
  valor4: number;
  valor5: number;
  valor6: string;
  //valor7: { name: number | Date, value: number }[]; 
}

const D3Charts: React.FC<D3ChartsProps> = ({ 
  valor1, 
  valor2, 
  //valor3, 
  valor4, 
  valor5, 
  valor6 
  //valor7 
}) => {


  const max = 50;  
  const min = 0;

/*
  console.log(valor1);
  console.log(valor2);
  console.log(valor3);
  console.log(valor4);
  console.log(valor5);
  console.log(valor6); 
  console.log(valor7); 
*/

  const [arregloFechas, setArregloFechas] = useState<string[]>([]);
  
  const valor1Decimal: number = isNaN(parseFloat(valor1)) ? 0 : parseFloat(valor1);

  const valor2Decimal: number = isNaN(parseFloat(valor2)) ? 0 : parseFloat(valor2);


  useEffect(() => {

    let fechaSlider;

    if(valor5 == 0)
    {
      setArregloFechas([]);
    } 

    if(valor6)
    {
      const datoValor6 = valor6;   
      const fecha = datoValor6[0][0];   

      //console.log(datoValor6[0][0]);

      if(fecha == null)
      {       
        if (arregloFechas.length > 0) 
        {
          //console.log(arregloFechas);
          fechaSlider = arregloFechas[arregloFechas.length-1];          
        } 
        else 
        {          
          //console.log("el arreglo se encuentra vacio por tanto no muestra fechas");          
        }
        //console.log(fechaSlider + "   nuloooo");
      }
      else
      {       
        setArregloFechas(prevFechas => [...prevFechas, fecha]); 
        fechaSlider = fecha;
        //console.log(fechaSlider+"     no nulo");
        //console.log(arregloFechas);
      }
    }
    else
    {
      //fechaSlider = arregloFechas[arregloFechas.length-1];
    }
    

    const svg = d3.select("#d3-svg");

      // Limpiar el contenido anterior
      svg.selectAll("*").remove();

      // Datos para el gráfico de dona
      const data1 = [valor1Decimal, max - valor1Decimal];
      const data2 = [valor2Decimal, max - valor2Decimal];
  
      // Configuración del gráfico de dona
      const width = 200;
      const height = 200;
      const radius = Math.min(width, height) / 2;
  
      const dimScale = d3.scaleLinear()
      .domain([min, max])
      .range([0,3]);

      const getColor = (value: d3.NumberValue) => {
        const info = dimScale(value);
        //console.log(info +"   "+value);
        if (info <= 1) {
          return ['green', 'grey'];
        } else if (info > 1 && info <= 2) {
          return ['yellow', 'grey'];
        } else {
          return ['red', 'grey'];
        }
      };
      
      const color1 = getColor(valor1Decimal);
      const color2 = getColor(valor2Decimal);

      var reflejo1 = 1;
      var reflejo2 = 1;

      if(valor1Decimal >= 25)
      {
        reflejo1 = 1;
      }
      else
      {
        reflejo1 = -1;
      }

      if(valor2Decimal >= 25)
      {
        reflejo2 = 1;
      }
      else
      {
        reflejo2 = -1;
      }

      const pie1 = d3.pie().startAngle((-Math.PI * reflejo1) / 2).endAngle((Math.PI * reflejo1) / 2);

      const pie2 = d3.pie().startAngle((-Math.PI * reflejo2) / 2).endAngle((Math.PI * reflejo2) / 2);
      
      const arc = d3.arc<d3.PieArcDatum<number>>().outerRadius(radius - 10).innerRadius(radius - 50);

      // Actualizar el gráfico de dona con los nuevos datos
      svg.selectAll("*").remove(); // Limpiar el contenido anterior

      svg.append("g")
        .attr("transform", `translate(${width / 2},${(height / 4)+40})`)
        .selectAll("path")
        .data(pie1(data1))
        .enter()
        .append("path")
        .attr("d",  arc as any)
        .attr("fill",  (d, i) => color1[i]); // Utilizar la escala de colores
      
      svg.append("text")
        .text(valor1Decimal.toFixed(2) + " min.")
        .attr("font-size","18px")
        .attr("fill","white")
        .attr("x", 55)
        .attr("y", 90);
      
        svg.append("text")
        .text("Tiempo de respuesta promedio del día")
        .attr("font-size","10px")        
        .attr("fill","grey")
        .attr("font-weight", 700)
        .attr("x", 0)
        .attr("y", 105);

      svg.append("g")
        .attr("transform", `translate(${width / 2},${((3*height) / 4)+60})`)
        .selectAll("path")
        .data(pie2(data2))
        .enter()
        .append("path")
        .attr("d",  arc as any)
        .attr("fill",  (d, i) => color2[i]);  

      svg.append("text")
        .text(valor2Decimal.toFixed(2) + " min.")
        .attr("font-size","18px")
        .attr("fill","white")
        .attr("x", 55)
        .attr("y", 210);
      
      svg.append("text")
        .text("Tiempo rta. prom. de la última hora")
        .attr("font-size","10px")
        .attr("fill","grey")
        .attr("font-weight", 700)
        .attr("x", 5)
        .attr("y", 225);


      const getTxtCountSlider = (value: number) => {
        if (value == 1) {
          return 'registrados en ese día';
        } else {
          return 'en la última hora';
        }
      };

      let textoIncidentesHOY = getTxtCountSlider(valor5);

        svg.append("text")
        .text("Cantidad de incidentes")
        .style("font-weight", 700)
        .attr("font-size","14px")
        .attr("fill","white")
        .attr("x", 5)
        .attr("y", 255);
        svg.append("text")
        .text(textoIncidentesHOY)
        .style("font-weight", 700)
        .attr("font-size","14px")
        .attr("fill","white")
        .attr("x", 5)
        .attr("y", 270);
        svg.append("text")
        .text("(Premier One)")
        .style("font-weight", 700)
        .attr("font-size","14px")
        .attr("fill","white")
        .attr("x", 5)
        .attr("y", 287);


        svg.append("text")
        .text(valor4)
        .attr("font-size","25px")
        .style("font-weight", 700)
        .attr("fill","white")
        .attr("x", 165)
        .attr("y", 285);

       
   
  
    }, [valor1, 
        valor2, 
        //valor3, 
        valor4, 
        valor5, 
        valor6
        //valor7
      ]);

  return (
    <div>

      <svg id="d3-svg" width={200} height={300}></svg>

    </div>
  );
};

// Export the component
export default D3Charts;