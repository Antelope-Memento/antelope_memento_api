/**
 * Check if the given object has all the properties
 * @param {Object} obj
 * @param {Array} properties
 * @returns {boolean}
 */
function hasProperties(obj, properties) {
    return properties.every((property) => obj.hasOwnProperty(property));
}

/**
 * Check if a string is a valid account name
 * @param {string} account
 * @returns {boolean}
 */
function isAccount(account) {
    if (typeof account !== 'string') {
        return false;
    }
    const nameRegex = new RegExp(/^[a-z1-5.]{1,13}$/);
    return nameRegex.test(account);
}

/**
 * Check if the given value is an array and is not empty
 * @param {Array} array
 * @returns {boolean}
 */
function isNotEmptyArray(array) {
    return Array.isArray(array) && array.length > 0;
}

/**
 * Check if an array is not empty and contains only valid account names
 * @param {string[]} accounts
 * @returns {boolean}
 */
function isNotEmptyArrayOfAccounts(accounts) {
    return isNotEmptyArray(accounts) && accounts.every(isAccount);
}

/**
 * Check if a string is a valid date
 * @param {string} dateString
 * @returns {boolean}
 */
function isDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date);
}

/**
 * Check if a value is a number
 * @param {any} value
 * @returns {boolean}
 */
function isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
}

/**
 * Convert a timestamp to a string that can be used in an SQL query
 * @param {string} timestamp - The timestamp
 * @param {boolean} isMysql - Whether the database is MySQL
 * @returns {string}
 */
function timestampToQuery(timestamp, isMysql) {
    const timestampInMilliseconds = Date.parse(timestamp) / 1000;
    return isMysql
        ? `FROM_UNIXTIME('${timestampInMilliseconds}')`
        : `to_timestamp('${timestampInMilliseconds}')`;
}

module.exports = {
    hasProperties,
    isAccount,
    isNotEmptyArray,
    isNotEmptyArrayOfAccounts,
    isDate,
    isNumber,
    timestampToQuery,
};
