import { Socket, Server } from 'socket.io';
import constants from '../../constants/config';
import {
    onTransactionHistory,
    getSocketStateActions as getTransactionsHistorySocketStateActions,
    manageForkEventSaveInState,
} from './transactionHistory';
import { Args } from './transactionHistory/types';

const { EVENT } = constants;

function onConnection(socket: Socket, io: Server) {
    console.log(
        `New socket connection: ${socket.id}, currently connected: ${io.sockets.sockets.size}`
    );

    const { clearSocketState } = getTransactionsHistorySocketStateActions(
        socket.id
    );
    manageForkEventSaveInState(io.sockets.sockets.size);

    socket.on(EVENT.TRANSACTION_HISTORY, (args: Args) => {
        console.log(
            `Client with IP: ${socket.handshake.address} listening for ${EVENT.TRANSACTION_HISTORY} event by accounts:(${args.accounts}).`
        );
        onTransactionHistory(socket, args);
    });

    socket.on(EVENT.DISCONNECT, () => {
        manageForkEventSaveInState(io.sockets.sockets.size);
        clearSocketState();

        console.log('Socket disconnected:', socket.id);
    });

    socket.on(EVENT.ERROR, (error) => {
        console.error('Socket error:', error);
    });
}

export { onConnection };
