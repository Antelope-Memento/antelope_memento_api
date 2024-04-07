import Sync from '../../database/models/sync.model';

export async function getIrreversibleBlockNumber() {
    // 'select MAX(irreversible) from SYNC'
    const maxIrreversible = await Sync.max<number, Sync>('irreversible');
    if (maxIrreversible === null) {
        throw new Error('sync table is empty');
    }
    return maxIrreversible;
}

export async function getHeadBlockNumber() {
    // 'select MAX(block_num) from SYNC'
    const headBlock = await Sync.max<number, Sync>('block_num');
    if (headBlock === null) {
        throw new Error('sync table is empty');
    }
    return headBlock;
}
