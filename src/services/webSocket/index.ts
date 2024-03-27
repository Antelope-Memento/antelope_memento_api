import { Socket, Server } from 'socket.io';
import constant from '../../constants/config';
import {
    onTransactionsHistory,
    getSocketStateActions as getTransactionsHistorySocketStateActions,
    manageForkTransactionsWriting,
} from './transactionsHistory';
import { Args } from './transactionsHistory/types';

function onConnection(socket: Socket, io: Server) {
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
