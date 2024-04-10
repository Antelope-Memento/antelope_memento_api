import { Socket, Server } from 'socket.io';
import constants from '../../constants/config';
import {
    onTransactionsHistory,
    getSocketStateActions as getTransactionsHistorySocketStateActions,
    manageForkTransactionsWriting,
} from './transactionsHistory';
import { Args } from './transactionsHistory/types';

const { EVENT } = constants;

function onConnection(socket: Socket, io: Server) {
    console.log('New socket connection:', socket.id);

    manageForkTransactionsWriting(io.sockets.sockets.size);

    socket.on(EVENT.TRANSACTIONS_HISTORY, (args: Args) => {
        onTransactionsHistory(socket, args);
    });
    socket.on(EVENT.DISCONNECT, () => {
        manageForkTransactionsWriting(io.sockets.sockets.size);
        getTransactionsHistorySocketStateActions(socket.id).clearSocketState();

        console.log('Socket disconnected:', socket.id);
    });
}

export { onConnection };
