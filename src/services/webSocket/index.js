const constant = require('../../constants/config');
const {
    onTransactionsHistory,
    getSocketStateActions: getTransactionsHistorySocketStateActions,
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
        getTransactionsHistorySocketStateActions(socket.id).clearSocketState();
    });
}

module.exports = { onConnection };
