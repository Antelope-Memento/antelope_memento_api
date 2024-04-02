import { Model, DataTypes } from '@sequelize/core';
import sequelize from '..';

class Sync extends Model {
    public sourceid!: number;
    public block_num!: number;
    public block_time!: Date;
    public block_id!: string;
    public irreversible!: number;
    public is_master!: number;
    public last_updated!: Date;
}

Sync.init(
    {
        sourceid: {
            type: DataTypes.INTEGER,
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
        block_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        irreversible: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        is_master: {
            type: DataTypes.SMALLINT,
            allowNull: false,
        },
        last_updated: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'SYNC',
        timestamps: false,
    }
);

export default Sync;
