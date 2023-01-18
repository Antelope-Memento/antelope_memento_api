# EOSIO Memento RPC Requirements

Memento server should be configured as below -

1. RESTful API: all parameters in GET URL parameters
2. Binding to a configurable address and port (`0.0.0.0:12345`, `127.0.0.1:54321`)
3. allow multiple concurrent HTTP requests
4. configurable for either Postgres or Mysql backend database
5. configurable for api endpoint prefix ( http://localhost:12345/wax/health, http://localhost:12345/eos/health, http://localhost:12345/tlos/health )

### RPC health requests

1. `health`. Returns HTTP status 200 if the SYNC is up to date within 20 seconds from real time; 503 otherwise

2. `is_healthy`. Returns `{status, errormsg}`, Status is boolean, and if it's false, errormsg is mandatory and explaining the problem.

### transaction status requests

1. `get_transaction (trx_id)`. Returns: `{status, block_num, block_time, trace}`. Status is one of: `unknown`, `reversible`, `irreversible`
2. `get_transaction_status (trx_id)`. Returns: `{status, block_num, block_time}`

### history queries

1. `get_account_history (account, options)`. Options: `irreversible: boolean`, `block_num_min: uint`,
`block_num_max: uint`, `block_time_min: DATETIME`, `block_time_max: DATETIME`. Returns: array of traces as in get_transaction.

2. `get_contract_history (contract, options)`. Options: same as in get_account_history, plus `actions: ARRAY of strings`.
Returns array of traces as in get_transaction.

# API Details

## How to run locally

1. Clone this repository
1. Create .env file in root dir using [example.env](https://github.com/ts0709/MementoAPIs/blob/main/example.env) file with proper values

1. Run from root dir using following commands

```
npm install
npm start

```

Server start listening on the specified port number

## API 1
url: http://localhost:54321/wax/is_healthy

Path: /is_healthy ( GET )

Response JSON: returns the execution result as below

```
{
  "status": true,
  "errormsg": "Healthy"
}
```

## API 2
url: http://localhost:54321/wax/health

Path: /health ( GET )

Response JSON: returns the execution result with status code 200 & 503 as below

status code: 200

```
{
  "msg": "Healthy"
}
```

status code: 503

```
{
  "msg": "The data was updated 19800 seconds ago"
}
```

## API 3
url: http://localhost:12345/wax/get_transaction?trx_id=transaction_id

Path: /get_transaction ( GET )

Query parameter: trx_id ( transaction id string type )

Response JSON: returns the execution result with status code 200

status code: 200

```
{
"irreversible": true,
"block_num": 224308181,
"block_time": "2023-01-13T09:19:50.000Z",
"trace": {
  ...
  }
}
```

## API 4
url: http://localhost:12345/wax/get_transaction_status?trx_id=transaction_id

Path: /get_transaction_status ( GET )

Query parameter: trx_id ( transaction id string type )

Response JSON: returns the execution result with status code 200

status code: 200

```
{
  "irreversible": true,
  "block_num": 224308181,
  "block_time": "2023-01-13T09:19:50.000Z"
}
```

## API 5
url: http://localhost:12345/wax/get_account_history?account=account_name&irreversible=false&block_num_min=224763920&block_num_max=224763922&block_time_min=2023-01-17T06:40:04&block_time_max=2023-01-17T06:47:05

Path: /get_account_history ( GET )

Query parameters: contract (string type), irreversible ( boolean ), block_num_min ( uint ), block_num_max ( uint ), block_time_min ( datetime ), block_time_max ( datetime )

Optional parameters: block_num_min, block_num_max, block_time_min, block_time_max

Response JSON: returns the execution result (list of trace objects) with status code 200

status code: 200

```
{
  "data": [
    {
      ...
    }
  ]
}
```

## API 6
url: http://localhost:12345/wax/get_contract_history?contract=contract_name&irreversible=true&block_num_min=224763920&block_num_max=224763922&block_time_min=2023-01-17T06:40:04&block_time_max=2023-01-17T06:47:05&actions=repair,recover,claim

Path: /get_contract_history ( GET )

Query parameters: contract (string type), irreversible ( boolean ), block_num_min ( uint ), block_num_max ( uint ), block_time_min ( datetime ), block_time_max ( datetime ), actions ( list of action: string type )

Optional parameters: block_num_min, block_num_max, block_time_min, block_time_max, actions

Response JSON: returns the execution result (list of trace objects) with status code 200

status code: 200

```
{
  "data": [
    {
      ...
    }
  ]
}
```

## Environment parameters
To set the environment parameters, copy [example.env](https://github.com/ts0709/MementoAPIs/blob/main/example.env) a new file `.env` before server start

```
SERVER_BIND_IP = 0.0.0.0 // Server bind IP address
SERVER_BIND_PORT = 12345 // Server bind port

MYSQL_DB_HOST = ----  //MYSQL DB host name
MYSQL_DB_PORT = 3350  //MYSQL DB port
MYSQL_DB_USER = ----  //MYSQL DB username
MYSQL_DB_PWD = ----   //MYSQL DB password
MYSQL_DB_NAME = ----  //MYSQL DB name

POSTGRES_DB_HOST = ---- //POSTGRES DB host name
POSTGRES_DB_PORT = 5501 //POSTGRES DB port
POSTGRES_DB_USER = ---- //POSTGRES DB username
POSTGRES_DB_PWD = ----  //POSTGRES DB password
POSTGRES_DB_NAME = ---- //POSTGRES DB name

CONNECTION_POOL = 10            // DB max connection pool size
DATABASE_SELECT = "MYSQL"       // Specify which Db type to select MYSQL or POSTGRES
HEALTHY_SYNC_TIME_DIFF = 15000  // Health check sync time interval
API_PATH_PREFIX = wax           // API path prefix wax, eos, tlos

CPU_CORES = 2   // number of cpu cores, value should not exceed max number of cores available in the system

MAX_RECORD_COUNT = 10  // maximum number of records that can be returned in a single request

```

# Acknowledgments
This work was sponsored by EOS Amsterdam block producer.

Copyright 2023 Raj Kumar (raj.rpt@gmail.com)
