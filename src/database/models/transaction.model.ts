import { Model, DataTypes } from '@sequelize/core';
import sequelize, { DIALECT } from '..';

const tableName = DIALECT === 'postgres' ? 'transactions' : 'TRANSACTIONS';

class Transaction extends Model {
    public seq!: number;
    public block_num!: number;
    public block_time!: Date;
    public trx_id!: string;
    public trace!: Buffer;
}

Transaction.init(
    {
        seq: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        block_num: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        block_time: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        trx_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        trace: {
            type: DataTypes.BLOB,
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName,
        timestamps: false,
    }
);

export default Transaction;
