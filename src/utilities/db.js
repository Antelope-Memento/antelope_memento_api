var mysql = require('mysql');
const Pool = require('pg').Pool
const constant = require("../constants/config");

var dbUtility = function() {};

const CreateMySqlConnectionPool = () => {
    var pool = mysql.createPool({
        connectionLimit: process.env.MYSQL_CONN_POOL,
        database: process.env.MYSQL_DB_NAME,
        host: process.env.MYSQL_DB_HOST,
        port: process.env.MYSQL_DB_PORT,
        user: process.env.MYSQL_DB_USER,
        password: process.env.MYSQL_DB_PWD
    });

    var serverCon = 0;
    var trackMySqlConnections = function trackPoolConnections(pool, limit) {
        pool.on('acquire', (conn) => {
            serverCon++;

            conn.timoutHandle = setTimeout(() => {
                console.log('mysql db connection ' + serverCon);
                console.log('Connection %d acquired past limit!', conn.threadId);
            }, limit);
        });
        pool.on('release', (conn) => {
            serverCon--;
            if (conn.timoutHandle) clearTimeout(conn.timoutHandle);
        });
    };

    trackMySqlConnections(pool, 600000);

    pool.on('connection', function(connection) {
        console.log('mysql db connections ' + pool._allConnections.length);
    });

    pool.on('enqueue', function() {
        console.log('Waiting for available mysql connection slot');
    });

    dbUtility["connection"] = pool;
}

const CreatePostgresConnectionPool = () => {

    const pool = new Pool({
        user: process.env.POSTGRES_DB_USER,
        host: process.env.POSTGRES_DB_HOST,
        database: process.env.POSTGRES_DB_NAME,
        password: process.env.POSTGRES_DB_PWD,
        port: process.env.POSTGRES_DB_PORT,
        max: process.env.MYSQL_CONN_POOL // specify the maximum number of connections in the pool
    });

    dbUtility["connection"] = pool;
}

dbUtility.CreateConnectionPool = () => {
    if (process.env.DATABASE_SELECT == constant.MYSQL_DB) {
        CreateMySqlConnectionPool();
    } else {
        CreatePostgresConnectionPool();
    }
};

dbUtility.CloseConnection = () => {
    dbUtility.connection?.end();
};

dbUtility.ExecuteQuery = (query, result) => {
    dbUtility.connection.query(query, (error, results) => {
        if (error) {
            console.log(error);
            result({
                status: 'error',
                msg: JSON.stringify(error)
            });
        } else {
            if (process.env.DATABASE_SELECT == constant.MYSQL_DB) {
                //  console.log('Mysql db');
                result({
                    status: 'success',
                    data: results
                });
            } else {
                //  console.log('Postgress db');
                result({
                    status: 'success',
                    data: results.rows
                });
            }
        }
    })
};

module.exports = dbUtility;
