import Sync from '../../database/models/sync.model';

export async function getIrreversibleBlockNumber() {
    // 'select MAX(irreversible) from SYNC'
    return Sync.max<number, Sync>('irreversible');
}

export async function getHeadBlockNumber() {
    // 'select MAX(block_num) from SYNC'
    return Sync.max<number, Sync>('block_num');
}
