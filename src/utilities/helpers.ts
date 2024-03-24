function hasProperties<T extends object>(
    obj: T,
    properties: (keyof T)[]
): boolean {
    return properties.every((property) => property in obj);
}

function isAccount(account: string): boolean {
    if (typeof account !== 'string') {
        return false;
    }
    const nameRegex = new RegExp(/^[a-z1-5.]{1,13}$/);
    return nameRegex.test(account);
}

function isNotEmptyArray(array: unknown[]): boolean {
    return Array.isArray(array) && array.length > 0;
}

function isNotEmptyArrayOfAccounts(accounts: string[]): boolean {
    return isNotEmptyArray(accounts) && accounts.every(isAccount);
}

function isDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

function timestampToQuery(timestamp: string, isMysql: boolean): string {
    const timestampInMilliseconds = Date.parse(timestamp) / 1000;
    return isMysql
        ? `FROM_UNIXTIME('${timestampInMilliseconds}')`
        : `to_timestamp('${timestampInMilliseconds}')`;
}

export {
    hasProperties,
    isAccount,
    isNotEmptyArray,
    isNotEmptyArrayOfAccounts,
    isDate,
    isNumber,
    timestampToQuery,
};
