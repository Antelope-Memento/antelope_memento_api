module.exports = constant = {
    STATUS_SUCCESS: "success",
    STATUS_FAILURE: "failure",
    DATA_SEND_ERROR: "Data send error",

    RECORD_NOT_FOUND: "Record not found",
    DB_READ_ERROR: "Unable to read db",
    MSG_HEALTHY: "Healthy",
    MSG_INCORRECT_PARAM: "Incorrect query parameter:",

    //HTTP Status codes
    HTTP_200_CODE: 200,
    HTTP_201_CODE: 201,
    HTTP_204_CODE: 204,
    HTTP_401_CODE: 401,
    HTTP_404_CODE: 404,
    HTTP_422_CODE: 422,
    HTTP_400_CODE: 400,
    HTTP_206_CODE: 206,
    HTTP_500_CODE: 500,
    HTTP_503_CODE: 503,

    MYSQL_DB: "MYSQL",
    POSTGRES_DB: "POSTGRES",

    VALIDATION_ERR_INVALID_CONTRACT: 1,
    VALIDATION_ERR_INVALID_ACCOUNT: 2,
    VALIDATION_ERR_INVALID_TIME_MIN: 3,
    VALIDATION_ERR_INVALID_TIME_MAX: 4,
    VALIDATION_ERR_INVALID_ACTION: 5,

    errors: [{
            name: 'TRX_ID_INVALID',
            message: 'Incorrect query parameter: trx_id',
            statusCode: 400
        },
        {
            name: 'CONTRACT_NAME_INVALID',
            message: 'Incorrect query parameter: contract',
            statusCode: 400
        },
        {
            name: 'ACCOUNT_NAME_INVALID',
            message: 'Incorrect query parameter: account',
            statusCode: 400
        },
        {
            name: 'TIME_MIN_INVALID',
            message: 'Incorrect query parameter: block_time_min',
            statusCode: 400
        },
        {
            name: 'TIME_MAX_INVALID',
            message: 'Incorrect query parameter: block_time_max',
            statusCode: 400
        },
        {
            name: 'ACTION_NAME_INVALID',
            message: 'Incorrect query parameter: action name',
            statusCode: 400
        },
        {
            name: 'DB_READ_ERR',
            message: 'Unable to read db',
            statusCode: 500
        }
    ],

};
