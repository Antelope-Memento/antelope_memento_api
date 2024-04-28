import { Op } from '@sequelize/core';
import EventLog from '../../database/models/eventLog.model';

enum EventType {
    trace = 1003,
    fork = 1001,
}

export async function getAll({
    fromId,
    toId,
}: {
    fromId: number;
    toId: number;
}): Promise<EventLog[]> {
    console.log('test fromId: ', fromId);
    console.log('test toId: ', toId);

    return EventLog.findAll({
        attributes: ['id', 'block_num', 'event_type', 'data'],
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

export function webSocketFormat(eventLogs: EventLog[], accounts: string[]) {
    const parsedTraces = eventLogs.map(({ data, ...tx }) => ({
        ...tx,
        data: JSON.parse(data.toString('utf8')),
    }));

    return parsedTraces
        .map((tx) => {
            if (tx.event_type === EventType.trace) {
                const findAcounts = (
                    tx.data.trace.action_traces as { receiver: string }[]
                ).some(({ receiver }) => accounts.includes(receiver));
                if (findAcounts) {
                    tx.id && delete (tx as { id?: unknown }).id;
                    tx.event_type &&
                        delete (tx as { event_type?: unknown }).event_type;
                    return {
                        ...tx,
                        type: 'trace' as const,
                    };
                }
            } else {
                tx.id && delete (tx as { id?: unknown }).id;
                tx.event_type &&
                    delete (tx as { event_type?: unknown }).event_type;
                return {
                    ...tx,
                    type: 'fork' as const,
                    data: null,
                };
            }
        })
        .filter(Boolean);
}
