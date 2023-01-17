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
1. Create .env file in root dir using example.env file with proper values
1. Run from root dir using following commands

```
npm install
npm start

```

Server start listening on the specified port number

## API 1
url: http://localhost:54321/wax/is_healthy

Method: /is_healthy ( GET )

Response JSON: returns the execution result as below

```
{
  "status": true,
  "errormsg": "Healthy"
}
```

## API 2
url: http://localhost:54321/wax/health

Method: /health ( GET )

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
url: http://localhost:12345/wax/transaction?trx_id=transaction_id

Method: /transaction ( GET )

Query parameter: trx_id ( transaction id )

Response JSON: returns the execution result with status code 200

status code: 200

```
{
"status": "executed",
"block_num": 224308181,
"block_time": "2023-01-13T09:19:50.000Z",
"trace": {
  "type": "Buffer",
  "data": []
  }
}
```

## API 4
url: http://localhost:12345/wax/transaction_status?trx_id=transaction_id

Method: /transaction_status ( GET )

Query parameter: trx_id ( transaction id )

Response JSON: returns the execution result with status code 200

status code: 200

```
{
  "status": "executed",
  "block_num": 224308181,
  "block_time": "2023-01-13T09:19:50.000Z"
}
```

## API 5
url: http://localhost:12345/wax/account_history?account=account_name&irreversible=false&block_num_min=224763920&block_num_max=224763922&block_time_min=2023/01/16 06:09:04&block_time_max=2023/01/16 06:09:05

Method: /account_history ( GET )

Query parameters: contract, irreversible ( boolean ), block_num_min ( uint ), block_num_max ( uint ), block_time_min (datetime), block_time_max(datetime)

Response JSON: returns the execution result with status code 200

status code: 200

```
{
  "data": [
    {
      "trace": {
        "type": "Buffer",
        "data": [...]
      }
    }
  ]
}
```

## API 6
url: http://localhost:12345/wax/contract_history?contract=contract_name&irreversible=true&block_num_min=224763920&block_num_max=224763922&block_time_min=2023/01/16 06:09:04&block_time_max=2023/01/16 06:09:05&actions=repair,recover,claim

Method: /contract_history ( GET )

Query parameters: contract, irreversible ( boolean ), block_num_min ( uint ), block_num_max ( uint ), block_time_min (datetime), block_time_max(datetime), actions ( list of action: string type )

Response JSON: returns the execution result with status code 200

status code: 200

```
{
  "data": [
    {
      "trace": {
        "type": "Buffer",
        "data": [...]
      }
    }
  ]
}
```

# Acknowledgments
This work was sponsored by EOS Amsterdam block producer.
