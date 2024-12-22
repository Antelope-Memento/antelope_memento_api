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
    return EventLog.findAll({
        attributes: ['id', 'block_num', 'event_type', 'data'],
        where: {
            id: {
                [Op.gt]: fromId,
                [Op.lte]: toId,
            },
        },
        order: [['id', 'ASC']],
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

export function webSocketFormat(
    eventLogs: EventLog[],
    accounts: string[],
    lastEventLogId: number,
    lastCheckedBlock: number
) {
    const parsedTraces = eventLogs.map(({ data, ...tx }) => ({
        ...tx,
        data: JSON.parse(data.toString('utf8')),
    }));

    return parsedTraces
        .filter((tx) => {
            if (lastEventLogId >= tx.id || lastCheckedBlock > tx.block_num) {
                return false;
            }
            if (tx.event_type === EventType.fork) return true;

            const hasAccountAmongReceivers = (
                tx.data.trace.action_traces as { receiver: string }[]
            ).some(({ receiver }) => accounts.includes(receiver));

            return hasAccountAmongReceivers;
        })
        .map((tx) => {
            if (tx.event_type === EventType.trace) {
                tx.id && delete (tx as { id?: unknown }).id;
                tx.event_type &&
                    delete (tx as { event_type?: unknown }).event_type;
                return {
                    ...tx,
                    type: 'trace' as const,
                };
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
        });
}
