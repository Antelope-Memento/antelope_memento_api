const constant = require('../../constants/config');
const {
    onTransactionsHistory,
    state: transactionsHistoryState,
} = require('./transactionsHistory/index');

/**
 * @param {Socket} socket - The socket that emitted the event
 */
function onConnection(socket) {
    socket.on(constant.EVENT.TRANSACTIONS_HISTORY, (args) => {
        onTransactionsHistory(socket, args);
    });
    socket.on(constant.EVENT.DISCONNECT, () => {
        if (transactionsHistoryState[socket.id]) {
            clearInterval(transactionsHistoryState[socket.id].intervalId);
            delete transactionsHistoryState[socket.id];
        }
    });
}

module.exports = { onConnection };
