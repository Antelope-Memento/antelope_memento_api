import { Sequelize } from '@sequelize/core';
import 'dotenv/config';

const DATABASE = process.env.DATABASE_SELECT; // 'POSTGRES' or 'MYSQL'

const CONFIG = {
    name: process.env[`${DATABASE}_DB_NAME`],
    username: process.env[`${DATABASE}_DB_USER`],
    password: process.env[`${DATABASE}_DB_PWD`],
    host: process.env[`${DATABASE}_DB_HOST`],
    port: process.env[`${DATABASE}_DB_PORT`],
    dialect: process.env.DATABASE_SELECT?.toLowerCase(),
};

if (
    !CONFIG.name ||
    !CONFIG.username ||
    (CONFIG.dialect !== 'mysql' && CONFIG.dialect !== 'postgres')
) {
    throw new Error('invalid database configuration');
}

const { name, username, password, host, port, dialect } = CONFIG;

const sequelize = new Sequelize(name, username, password, {
    dialect,
    host,
    port,
    logging: false, // displays the first parameter of the log function call if true
});

sequelize
    .authenticate()
    .then(() => {
        console.log(`connected to ${dialect} ${name} database`);
    })
    .catch((err) => {
        console.error(
            `unable to connect to the ${dialect} ${name} database: ${err}`
        );
    });

export const DIALECT = sequelize.dialect.name;

export default sequelize;
