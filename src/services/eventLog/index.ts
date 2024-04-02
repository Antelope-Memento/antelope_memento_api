import { Op } from '@sequelize/core';
import EventLog from '../../database/models/event_log.model';

export async function getAll({
    fromId,
    toId,
}: {
    fromId: number;
    toId: number;
}): Promise<EventLog[]> {
    return EventLog.findAll({
        attributes: ['id', 'block_num', 'data'],
        where: {
            id: {
                [Op.gt]: fromId,
                [Op.lte]: toId,
            },
        },
        order: [['id', 'DESC']],
        raw: true,
    });
}

export async function getMaxEventLog(blockNum: number) {
    return EventLog.max<number, EventLog>('id', {
        where: {
            block_num: blockNum,
        },
    });
}

export function format(eventLogs: EventLog[], accounts: string[]) {
    const parsedTraces = eventLogs.map(({ data, ...tx }) => ({
        ...tx,
        type: 'fork' as const,
        data: JSON.parse(data.toString('utf8')),
    }));

    return parsedTraces.filter((tx) =>
        (tx.data.trace.action_traces as { receiver: string }[]).some(
            ({ receiver }) => accounts.includes(receiver)
        )
    );
}
