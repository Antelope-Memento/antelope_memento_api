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
    console.log('postgres db connected');
}


dbUtility.CreateConnectionPool = () => {
    if (process.env.DATABASE_SELECT == constant.MYSQL_DB) {
        CreateMySqlConnectionPool();
        dbUtility.is_mysql = true;
    } else if (process.env.DATABASE_SELECT == constant.POSTGRES_DB) {
        CreatePostgresConnectionPool();
        dbUtility.is_pg = true;
    } else {
        throw Error('Invalid value in env.DATABASE_SELECT: ' + process.env.DATABASE_SELECT);
    }
};


dbUtility.CloseConnection = () => {
    dbUtility.connection?.end();
};


dbUtility.ExecuteQuery = (query, resultRows) => {
    dbUtility.connection.query(query, (error, results) => {
        if (error) {
            throw error;
        }

        if (dbUtility.is_mysql) {
            resultRows(results);
        } else {
            resultRows(results.rows);
        }
    });
};


dbUtility.ExecuteQueryAsync = async (query) => {
    return new Promise((resolve, reject) => {
        try {
            dbUtility.ExecuteQuery(query, (results) => {
                resolve(results);
            });
        } catch (err) {
            reject(err);
        }
    });
};



dbUtility.GetIrreversibleBlockNumber = async () => {
    return new Promise((resolve, reject) => {
        dbUtility.ExecuteQuery('select MAX(irreversible) as irrev from SYNC', (data) => {
            if (data.length > 0) {
                resolve(parseInt(data[0].irrev));
            } else {
                reject("SYNC table is empty");
            }
        });
    });
}


module.exports = dbUtility;
