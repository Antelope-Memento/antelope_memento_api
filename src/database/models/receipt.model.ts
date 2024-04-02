import { Model, DataTypes } from '@sequelize/core';
import sequelize from '..';

const tableName =
    sequelize.dialect.name === 'postgres' ? 'receipts' : 'RECEIPTS';

class Receipt extends Model {
    public seq!: number;
    public block_num!: number;
    public block_time!: Date;
    public contract!: string;
    public action!: string;
    public receiver!: string;
    public recv_sequence!: number;
}

Receipt.init(
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
        contract: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        receiver: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        recv_sequence: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName,
        timestamps: false,
    }
);
export default Receipt;
