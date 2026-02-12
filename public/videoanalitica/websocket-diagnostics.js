// websocket-diagnostics.js - Extracted from inline script for CSP compliance
let socket = null;
const log = document.getElementById('log');

function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = type;
    entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

document.getElementById('connect').addEventListener('click', () => {
    try {
        addLog(`Intentando conectar al WebSocket...`);
        
        if (socket) {
            addLog('Cerrando conexión existente...', 'info');
            socket.disconnect();
            socket = null;
        }
        
        const serverUrl = window.location.origin;
        addLog(`Conectando a: ${serverUrl}`);
        
        socket = io(serverUrl, {
            path: '/socket.io',
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: 3,
            timeout: 10000,
            forceNew: true
        });
        
        socket.on('connect', () => {
            addLog(`Conectado exitosamente! ID: ${socket.id}`, 'success');
            addLog(`Transport: ${socket.io.engine.transport.name}`, 'info');
        });
        
        socket.on('connect_error', (err) => {
            addLog(`Error de conexión: ${err.message}`, 'error');
            console.error('Connection error details:', err);
        });
        
        socket.on('disconnect', (reason) => {
            addLog(`Desconectado: ${reason}`, 'info');
        });
        
        socket.on('update', (data) => {
            addLog(`Update recibido: ${JSON.stringify(data)}`, 'success');
        });
        
        socket.io.engine.on('upgrade', (transport) => {
            addLog(`Transport actualizado a: ${transport.name}`, 'info');
        });
        
    } catch (e) {
        addLog(`Error inicializando: ${e.message}`, 'error');
    }
});

document.getElementById('joinChannel').addEventListener('click', () => {
    if (!socket || !socket.connected) {
        addLog('No hay conexión activa', 'error');
        return;
    }
    
    const channelId = document.getElementById('channelId').value;
    if (!channelId) {
        addLog('Por favor ingresa un Canal ID', 'error');
        return;
    }
    
    addLog(`Uniéndose al canal: ${channelId}`);
    socket.emit('join_channel', { channel_id: channelId }, (response) => {
        if (response && response.success) {
            addLog(`Unido al canal ${channelId} exitosamente`, 'success');
        } else {
            addLog(`Error uniéndose al canal: ${response?.error || 'Unknown error'}`, 'error');
        }
    });
});

document.getElementById('requestUpdate').addEventListener('click', () => {
    if (!socket || !socket.connected) {
        addLog('No hay conexión activa', 'error');
        return;
    }
    
    addLog('Solicitando update...');
    socket.emit('request_update', { timestamp: Date.now() });
});

document.getElementById('disconnect').addEventListener('click', () => {
    if (socket) {
        addLog('Desconectando...', 'info');
        socket.disconnect();
        socket = null;
    } else {
        addLog('No hay conexión para desconectar', 'info');
    }
});

document.getElementById('clear').addEventListener('click', () => {
    // ✅ SEGURIDAD: Usar textContent en lugar de innerHTML para prevenir XSS
    log.textContent = '';
    addLog('Log limpiado', 'info');
});

// Auto-connect al cargar la página
window.addEventListener('load', () => {
    addLog('Página cargada. Presiona "Conectar" para iniciar', 'info');
});