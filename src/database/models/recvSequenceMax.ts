import { Model, DataTypes } from '@sequelize/core';
import sequelize, { DIALECT } from '..';

const tableName =
    DIALECT === 'postgres' ? 'recv_sequence_max' : 'RECV_SEQUENCE_MAX';

class RecvSequenceMax extends Model {
    public account_name!: string;
    public recv_sequence_max!: number;
}

RecvSequenceMax.init(
    {
        account_name: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        recv_sequence_max: {
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
export default RecvSequenceMax;
