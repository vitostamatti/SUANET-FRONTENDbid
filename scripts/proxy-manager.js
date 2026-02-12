// Script para gestionar el proxy dinámico del frontend
const fetch = require('node-fetch'); // npm install node-fetch si no está instalado

class ProxyManager {
  constructor(frontendServerUrl = 'http://localhost:3000') {
    this.frontendServerUrl = frontendServerUrl;
  }

  // Obtener estado actual del proxy
  async getProxyStatus() {
    try {
      const response = await fetch(`${this.frontendServerUrl}/proxy-status`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error obteniendo estado del proxy:', error);
      throw error;
    }
  }

  // Actualizar URL del backend
  async updateBackendUrl(newBackendUrl) {
    try {
      const response = await fetch(`${this.frontendServerUrl}/update-backend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backendUrl: newBackendUrl
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Backend URL actualizada:', data.data);
      } else {
        console.error('❌ Error actualizando backend URL:', data.message);
      }
      
      return data;
    } catch (error) {
      console.error('Error actualizando backend URL:', error);
      throw error;
    }
  }

  // Monitorear estado del proxy
  async monitorProxy(intervalSeconds = 30) {
    console.log(`🔍 Iniciando monitoreo del proxy cada ${intervalSeconds} segundos...`);
    
    setInterval(async () => {
      try {
        const status = await this.getProxyStatus();
        const timestamp = new Date().toISOString();
        
        console.log(`[${timestamp}] Proxy Status:`, {
          backend: status.data.backendUrl,
          healthy: status.data.backendHealthy ? '✅' : '❌',
          registered: status.data.registrationStatus ? '✅' : '❌'
        });
        
        if (!status.data.backendHealthy) {
          console.warn('⚠️ Backend no está saludable!');
        }
        
        if (!status.data.registrationStatus) {
          console.warn('⚠️ Frontend no está registrado con backend!');
        }
        
      } catch (error) {
        console.error('❌ Error en monitoreo:', error.message);
      }
    }, intervalSeconds * 1000);
  }
}

// Uso del script
if (require.main === module) {
  const manager = new ProxyManager();
  
  const command = process.argv[2];
  const arg = process.argv[3];
  
  switch (command) {
    case 'status':
      manager.getProxyStatus()
        .then(status => console.log('Estado del proxy:', JSON.stringify(status, null, 2)))
        .catch(console.error);
      break;
      
    case 'update':
      if (!arg) {
        console.error('Uso: node proxy-manager.js update <nueva-url-backend>');
        process.exit(1);
      }
      manager.updateBackendUrl(arg)
        .then(result => console.log('Resultado:', result))
        .catch(console.error);
      break;
      
    case 'monitor':
      const interval = parseInt(arg) || 30;
      manager.monitorProxy(interval);
      break;
      
    default:
      console.log(`
Uso: node proxy-manager.js <comando> [argumentos]

Comandos:
  status                    - Obtener estado actual del proxy
  update <backend-url>      - Actualizar URL del backend
  monitor [interval]        - Monitorear proxy (intervalo en segundos, default: 30)

Ejemplos:
  node proxy-manager.js status
  node proxy-manager.js update http://localhost:8080
  node proxy-manager.js monitor 60
      `);
  }
}

module.exports = ProxyManager;