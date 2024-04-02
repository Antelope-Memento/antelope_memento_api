import { Sequelize } from '@sequelize/core';
import 'dotenv/config';

const database = process.env.DATABASE_SELECT; // 'postgres' or 'mysql'

if (database !== 'POSTGRES' && database !== 'MYSQL') {
    throw new Error('DATABASE_SELECT must be set to either POSTGRES or MYSQL');
}

const url =
    database === 'POSTGRES' ? process.env.POSTGRES_URL : process.env.MYSQL_URL;

if (!url) {
    throw new Error('database URL is undefined');
}

const sequelize = new Sequelize(url, {
    logging: false, // Default, displays the first parameter of the log function call
});

export default sequelize;
