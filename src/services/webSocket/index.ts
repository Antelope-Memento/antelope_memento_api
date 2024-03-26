import { Socket, Server } from 'socket.io';
import constant from '../../constants/config';
import {
    onTransactionsHistory,
    getSocketStateActions as getTransactionsHistorySocketStateActions,
    manageForkTransactionsWriting,
} from './transactionsHistory';
import { Args } from './transactionsHistory/types';

function onConnection(socket: Socket, io: Server) {
    // The connection serves only one request at a time.
    // A subsequent call on startStreaming will cancel the previous streaming request in this socket.
    // @TODO: somehow identify the client and cancel the previous connection if the client is the same.
    manageForkTransactionsWriting(io.sockets.sockets.size);

    socket.on(constant.EVENT.TRANSACTIONS_HISTORY, (args: Args) => {
        onTransactionsHistory(socket, args);
    });
    socket.on(constant.EVENT.DISCONNECT, () => {
        manageForkTransactionsWriting(io.sockets.sockets.size);
        getTransactionsHistorySocketStateActions(socket.id).clearSocketState();
    });
}

export { onConnection };
