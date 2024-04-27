import express from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import cluster from 'cluster';
import { Server } from 'socket.io';

import 'dotenv/config';

import router from './routes/routes';
import sequelize from './database';
import constants from './constants/config';
import { onConnection } from './services/webSocket';

const { EVENT } = constants;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
    },
    path: `/${process.env.API_PATH_PREFIX}/socket.io`,
    transports: ['websocket'],
});

io.on(EVENT.CONNECTION, (socket) => {
    onConnection(socket, io);
});

// @todo: use `zod` or other library for validation
const required_options = [
    'SERVER_BIND_IP',
    'SERVER_BIND_PORT',
    'DATABASE_SELECT',
    'HEALTHY_SYNC_TIME_DIFF',
    'API_PATH_PREFIX',
    'CPU_CORES',
    'MAX_RECORD_COUNT',
    'WS_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD',
    'WS_TRACE_TRANSACTIONS_LIMIT',
    'WS_EVENTLOG_TRANSACTIONS_LIMIT',
    'CONNECTION_POOL',
];

required_options.forEach((item, i) => {
    if (process.env[item] === undefined) {
        console.error(`Environment option ${item} is not defined`);
        process.exit(1);
    }
});

app.use(
    cors({
        origin: '*',
    })
);

app.use(
    morgan(
        ':method :url :status :res[content-length] - :response-time ms :remote-addr'
    )
);
app.use(express.json());

app.use(`/${process.env.API_PATH_PREFIX}`, router);

app.get(`/${process.env.API_PATH_PREFIX}`, (req, res) => {
    res.send('Memento API');
});

const port = Number(process.env.SERVER_BIND_PORT) || 12345;
const bind_ip = process.env.SERVER_BIND_IP || '0.0.0.0';

createClusteredServer(bind_ip, port, Number(process.env.CPU_CORES));

//create clustered server and bind with specified ip address and port number
function createClusteredServer(ip: string, port: number, clusterSize: number) {
    if (clusterSize > 1) {
        if (cluster.isMaster) {
            console.log(`Master ${process.pid} is running`);

            // Fork workers.
            for (let i = 0; i < clusterSize; i++) {
                cluster.fork();
            }

            cluster.on('exit', (worker, code, signal) => {
                console.log(`worker ${worker.process.pid} died`);
                if (signal == 'SIGKILL') {
                    gracefulExit();
                    process.exit(0);
                } else {
                    cluster.fork();
                }
                console.log('Starting a new worker ');
            });
        } else {
            server.listen(port, ip, () => {
                console.log(`listening on port no ${port}`);
            });
            console.log(`Worker ${process.pid} started`);
        }
    } else {
        server.listen(port, ip, () => {
            console.log(`listening on port no ${port}`);
        });
    }
}

function gracefulExit() {
    console.log('Close DB connection');
    sequelize.close();
    process.exit(0);
}

// If the Node process ends, close the DB connection
process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);

process.on('uncaughtException', function (error) {
    console.log('uncaughtException ' + error);
});

process.on('unhandledRejection', (_reason, promise) => {
    console.error('Unhandled Rejection at:', promise);
});

export default app;
