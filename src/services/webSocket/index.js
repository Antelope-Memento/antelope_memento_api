const constant = require('../../constants/config');
const {
    onTransactionsHistory,
    getSocketStateActions: getTransactionsHistorySocketStateActions,
    manageEventLogsScanning,
} = require('./transactionsHistory/index');

/**
 * @param {Socket} socket - The socket that emitted the event
 * @param {Object} io - The socket.io server instance
 * @param {Map} connectedClients - The map of connected clients
 */
function onConnection(socket, io, connectedClients) {
    const clientIp = socket.handshake.address;

    if (connectedClients.has(clientIp)) {
        socket.disconnect();
    } else {
        connectedClients.set(clientIp, true);

        manageEventLogsScanning(io.sockets.sockets.size);

        socket.on(constant.EVENT.TRANSACTIONS_HISTORY, (args) => {
            onTransactionsHistory(socket, args);
        });
        socket.on(constant.EVENT.DISCONNECT, () => {
            manageEventLogsScanning(io.sockets.sockets.size);
            getTransactionsHistorySocketStateActions(
                socket.id
            ).clearSocketState();
            connectedClients.delete(clientIp);
        });
    }
}

module.exports = { onConnection };
