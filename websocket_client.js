const io = require("socket.io-client");

// Recibir la URL del servidor y el channel_id como argumentos desde la línea de comandos
const serverUrl = process.argv[2];
const channel_id = process.argv[3];

if (!serverUrl || !channel_id) {
    console.error("Uso: node websocket_client.js <server_url> <channel_id>");
    console.error("     node websocket_client.js http://172.20.1.3 123");
    console.error("     node websocket_client.js http://suanet-tunnel-ssh-hulk-internal:1555 123");
    process.exit(1);
}

// Conectar al servidor WebSocket
const socket = io(serverUrl, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
});

socket.on("connect", () => {
    console.log(`Conectado al servidor WebSocket en ${serverUrl}.`);

    // Unirse a la sala del canal
    socket.emit("join_channel", { channel_id: channel_id }, (response) => {
        if (response && response.success) {
            console.log(`Unido al canal ${channel_id}:`, response.message);
        } else {
            console.error("Error al unirse al canal:", response.error);
        }
    });
});

// Escuchar las actualizaciones del canal
socket.on("update", (data) => {
    let truncatedData = JSON.parse(JSON.stringify(data));
    
    // If there's image data, truncate it for logging
    if (truncatedData.image && truncatedData.image.length > 100) {
        const imageLength = truncatedData.image.length;
        truncatedData.image = truncatedData.image.substring(0, 50) + 
            `... [${imageLength} chars total]`;
    }
    
    console.log("Actualización recibida:", truncatedData);
});

// Manejar errores de conexión
socket.on("connect_error", (error) => {
    console.error("Error de conexión:", error);
});

socket.on("disconnect", () => {
    console.log("Desconectado del servidor WebSocket.");
});

// Manejar la salida del cliente
process.on("SIGINT", () => {
    console.log("Cerrando conexión...");
    
    if (socket && socket.connected) {
        socket.emit("leave_channel", { channel_id: channel_id });
        socket.disconnect();
    }
    // Wait briefly before exiting to allow cleanup
    setTimeout(() => {
        console.log('Proceso terminado correctamente.');
        process.exit(0);
    }, 1000);
});