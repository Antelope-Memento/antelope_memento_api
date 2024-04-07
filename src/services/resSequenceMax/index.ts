import RecvSequenceMax from '../../database/models/recvSequenceMax';

export async function getMaxRecvSequence(account: string) {
    const seq = await RecvSequenceMax.findOne({
        where: { account_name: account },
    });

    if (!seq) {
        throw new Error(
            `account ${account} not found in recv_sequence_max table`
        );
    }

    return seq.recv_sequence_max;
}
