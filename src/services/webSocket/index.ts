import { Socket, Server } from 'socket.io';
import constant from '../../constants/config';
import {
    onTransactionsHistory,
    getSocketStateActions as getTransactionsHistorySocketStateActions,
    manageEventLogsScanning,
} from './transactionsHistory';
import { Args } from './transactionsHistory/types';

function onConnection(
    socket: Socket,
    io: Server,
    connectedClients: Map<string, boolean>
) {
    const clientIp = socket.handshake.address;

    if (connectedClients.has(clientIp)) {
        socket.disconnect();
    } else {
        connectedClients.set(clientIp, true);

        manageEventLogsScanning(io.sockets.sockets.size);

        socket.on(constant.EVENT.TRANSACTIONS_HISTORY, (args: Args) => {
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

export { onConnection };
