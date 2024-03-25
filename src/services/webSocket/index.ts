import { Socket, Server } from 'socket.io';
import constant from '../../constants/config';
import {
    onTransactionsHistory,
    getSocketStateActions as getTransactionsHistorySocketStateActions,
    manageForkTransactionsScanning,
} from './transactionsHistory';
import { Args } from './transactionsHistory/types';

function onConnection(socket: Socket, io: Server) {
    manageForkTransactionsScanning(io.sockets.sockets.size);

    socket.on(constant.EVENT.TRANSACTIONS_HISTORY, async (args: Args) => {
        await onTransactionsHistory(socket, args);
    });
    socket.on(constant.EVENT.DISCONNECT, () => {
        manageForkTransactionsScanning(io.sockets.sockets.size);
        getTransactionsHistorySocketStateActions(socket.id).clearSocketState();
    });
}

export { onConnection };
