const constant = require('../../constants/config');
const {
    onTransactionsHistory,
    clearSocketState: clearTransactionsHistorySocketState, // clear for a specific socket
    manageEventLogsScanning,
} = require('./transactionsHistory/index');

/**
 * @param {Socket} socket - The socket that emitted the event
 * @param {Object} io - The socket.io server instance
 */
function onConnection(socket, io) {
    manageEventLogsScanning(io.sockets.sockets.size);

    socket.on(constant.EVENT.TRANSACTIONS_HISTORY, (args) => {
        onTransactionsHistory(socket, args);
    });
    socket.on(constant.EVENT.DISCONNECT, () => {
        manageEventLogsScanning(io.sockets.sockets.size);
        clearTransactionsHistorySocketState(socket.id);
    });
}

module.exports = { onConnection };
