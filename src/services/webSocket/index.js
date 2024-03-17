const constant = require('../../constants/config');
const {
    onTransactionsHistory,
    interval,
} = require('./transactionsHistory/index');

/**
 * @param {Socket} socket - The socket that emitted the event
 */
function onConnection(socket) {
    socket.on(constant.EVENT.TRANSACTIONS_HISTORY, (args) => {
        onTransactionsHistory(socket, args);
    });
    socket.on(constant.EVENT.DISCONNECT, () => {
        clearInterval(interval[socket.id]);
        delete interval[socket.id];
    });
}

module.exports = { onConnection };
