import { Model, DataTypes } from '@sequelize/core';
import sequelize from '..';

const tableName =
    sequelize.dialect.name === 'postgres' ? 'event_log' : 'EVENT_LOG';

class EventLog extends Model {
    public id!: number;
    public block_num!: number;
    public event_type!: number;
    public data!: Buffer;
}

EventLog.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        block_num: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        event_type: {
            type: DataTypes.SMALLINT,
            allowNull: false,
        },
        data: {
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

export default EventLog;
