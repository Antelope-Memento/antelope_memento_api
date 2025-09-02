# Antelope-Memento API

[Memento](https://github.com/Antelope-Memento/antelope_memento) is a
lightweight history service for Antelope (ex-EOSIO) blockchains.

This Node.js package presents an HTTP API on top of Memento
database. It supports both MySQL and Postgres backends.

## RESTful API

In all calls, the URL prefix is configurable, so if `API_PATH_PREFIX`
is set to `wax`, the full URL for an API call would look like
`http://yourhost/wax/get_transaction?trx_id=287d48f2de0e3d5e9474d6829b536a7895f612784e9b58a0653513cf9602e8fb`.

Normally you would run an SSL termination proxy, such as nginx, in
front of the API, so the end-user URL would be starting with
`https://`.

All API calls are HTTP GET requests with mandatory and optional
arguments.

### `/health`

The call is useful for load balancers, as it reports the error in HTTP
code if the backend is unhealthy.

Arguments: none.

Returns HTTP status 200 if the timestamp of the head block in the
backend database is within 20 seconds from current time, or 503 if
it's too far in the past.

### `/is_healthy`

The call is similar to `/health`, but it returns the status code 200
if the database is operational, but not up to date.

Arguments: none.

Returns a JSON object with `status` and `diff` fields. Status is
boolean and `diff` indicates how long in milliseconds the database is
behind the real time.

### `/get_transaction`

The call is retrieving a transaction by its ID.

Mandatory argument: `trx_id`.

Returns a JSON object with fields `known` (boolean), `irreversible`
(boolean, only if known is true) and `data` (the full transaction
trace, only if known is true).

If a transaction ID is not found in the database, the result has known=false.

### `/get_transaction_status`

The call checks if a transaction ID is known to the database.

Mandatory argument: `trx_id`.

Returns a JSON object with fields `known` (boolean), `irreversible`
(boolean, only if known is true), `block_num` and `block_time` (only
if known is true).

If a transaction ID is not found in the database, the result has known=false.

### `/get_account_history`

The call retrieves transaction traces that are relevant to a specified
account, and it allows narrowing the scope by optional arguments.

The call returns a JSON object with the fields
`last_irreversible_block` (uint) and `data` (array of objects with
fields `pos` and `trace`). The array is empty if nothing is found.

Position (pos) is equal to `recv_sequence` number for the
account. Multiple positions for the same account may correspond to the
same transaction. The `get_account_history` picks the maximum
`recv_sequence` value within each transaction and returns it as `pos`
parameter.

Mandatory argument: `account`.

Optional arguments:

-   `irreversible` (boolean): if set to true, the result will only
    contain irreversible transactions.

-   `max_count` (uint): maximum number of records. The result is also
    limited by MAX_RECORD_COUNT configuration setting, so the count
    parameter may reduce the output if desired.

-   `pos` (int): if negative, the resulting traces will start from
    `recv_sequence` that is this far from the latest sequence number. If
    positive, the parameter specifies the starting value of
    `recv_sequence`. If omitted, the request returns up to
    MAX_RECORD_COUNT last traces for the account.

-   `action_filter` (string): if specified, the result will be filtered
    by the contract and action. Format: `CONTRACT:ACTION`.

### `/get_pos`

The call returns the minimum position number (`recv_sequence` number)
for the first transaction not earlier than the specified timestamp. It
returns `null` if there are no transactions at or after the specified
timestamp.

Mandatory argument: `account`. `timestamp`.

## GraphQL API

The GraphQL interface is accessible at `/graphql` location from the
base URL (e.g. `https://memento.eu.eosamsterdam.net/wax/graphql`). It
allows performing the same requests as in the RESTful API.

### Types

-   `transaction_status`:

    -   `known: Boolean!`
    -   `irreversible: Boolean`
    -   `block_num: Int`
    -   `block_time: String`
    -   `data: GraphQLJSON`

-   `history_data`:
    -   `last_irreversible_block: Unsigned Int!`
    -   `data: [GraphQLJSON]!`

### Queries

The following queries are supported:

-   `account_history`: returns `history_data`

    -   `account: String!`
    -   `irreversible: Boolean`
    -   `max_count: Int`
    -   `pos: String` (long integer as string)
    -   `action_filter: String`

-   `get_pos`: returns String

    -   `account: String!`
    -   `timestamp: String!`

-   `transaction`: returns transaction_status
    -   `trx_id: String!`



## WebSocket API

The WebSocket API allows subscribing to real-time updates from the
blockchain. The [socket.io](https://socket.io/) messaging library is
used by the server and client.

The client subscribes to the stream by sending a `transaction_history`
message, specifying the accounts it needs to monitor, optional
starting block, and a flag indicating whether the client needs to
receive irreversible transactions only, or it needs the transactions
from the head block.

Example of a client-side javascript code:

```javascript
// npm i socket.io-client

import { io } from 'socket.io-client';

const socket = io('https://memento.eu.eosamsterdam.net', {
    path: '/wax/socket.io',
    transports: ['websocket'],
});

socket.on('connect', () => {
    console.log('connected to memento-api websocket');

    // subscribe to the transaction_history event after the connection is established
    socket.emit('transaction_history', {
        accounts: ['account1', 'account2'], // array of account names, required
        start_block: 298284392, // start reading from the block_num, optional (head block is used by default)
        irreversible: true, // only irreversible transactions, optional (false by default)
    });
});

socket.on('disconnect', () => {
    console.log('disconnected from memento-api websocket');
});

// start receiving the transaction data
socket.on('transaction_history', (data, ack) => {
    console.log(data);
    ack(); // acknowledge the receipt of the data, required (otherwise the server will stop sending data)
});

socket.on('error', (error) => {
    console.error(error);
});
```

Example of 'transaction_history' event data:

```json
[
    {
        "block_num": "298284392",
        "type": "trace",
        "data": {
            "trace": {
                "block_num": "298284392",
                "block_timestamp": "2024-03-16T18:47:03.500",
                "trace": {
                    "id": "8efb8c0b850042c2c5801fa85532c46cc3cf9fdd49e1dbf6e8af28854a8ae7e1",
                    "status": "executed",
                    "cpu_usage_us": "436",
                    "net_usage_words": "24",
                    "elapsed": "350",
                    "net_usage": "192",
                    "scheduled": "false",
                    "action_traces": [
                        {
                            "action_ordinal": "1",
                            "creator_action_ordinal": "0",
                            "receipt": {
                                "receiver": "novarallytok",
                                "act_digest": "de17ddb2c14e205fb914664eb7b5dbb852e62fc56af645786be7a4b2569763c3",
                                "global_sequence": "88656190165",
                                "recv_sequence": "9081688",
                                "auth_sequence": [
                                    {
                                        "account": "n2jbm.wam",
                                        "sequence": "59458"
                                    }
                                ],
                                "code_sequence": "1",
                                "abi_sequence": "1"
                            },
                            "receiver": "novarallytok",
                            "act": {
                                "account": "novarallytok",
                                "name": "transfer",
                                "authorization": [
                                    {
                                        "actor": "n2jbm.wam",
                                        "permission": "active"
                                    }
                                ],
                                "data": {
                                    "from": "n2jbm.wam",
                                    "to": "swap.alcor",
                                    "quantity": "992426 SNAKGAS",
                                    "memo": "swapexactin#277#n2jbm.wam#1.53894783 WAX@eosio.token#0"
                                }
                            },
                            "context_free": "false",
                            "elapsed": "66",
                            "console": "11328360222704429312INFO quantity.amount: 992426 @ 18:47:3 novarallytok.cpp[114](transfer)\n",
                            "account_ram_deltas": [],
                            "except": "",
                            "error_code": null,
                            "return_value": ""
                        }
                    ],
                    "account_ram_delta": null,
                    "except": "",
                    "error_code": null,
                    "failed_dtrx_trace": [],
                    "partial": {
                        "expiration": { "utc_seconds": "1710615175" },
                        "ref_block_num": "30039",
                        "ref_block_prefix": "1394522270",
                        "max_net_usage_words": "0",
                        "max_cpu_usage_ms": "0",
                        "delay_sec": "0",
                        "transaction_extensions": [],
                        "signatures": [
                            "SIG_K1_KAYsXVfqbgMMtsWbQUzWVsiaLkfTLBn6d1b8XnCCndo9MaZrmo35hzDzLDmabqUrmKxNHoShnsQFDao9i3FSkkqoNZdWGA",
                            "SIG_K1_K54UkopGBj1mWswfo9h1grPT52A2T3TvYPRJiFpwBEhdFGytgS5VQboTakdUP5Co2TniTFg1PMmcUh2bM4hgpyE69muSJa"
                        ],
                        "context_free_data": []
                    }
                }
            }
        }
    }
]
```

## Installation

```
# install Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# get the API
git clone https://github.com/Antelope-Memento/antelope_memento_api.git /opt/antelope_memento_api
cd /opt/antelope_memento_api
npm ci
npm run build
cp systemd/memento_api\@.service /etc/systemd/system/
systemctl daemon-reload

# example for a WAX MySQL database
cat >/etc/opt/memento_api_wax.env <<'EOT'
SERVER_BIND_IP = 127.0.0.1
SERVER_BIND_PORT = 3001
MYSQL_DB_HOST = 10.0.3.210
MYSQL_DB_PORT = 3306
MYSQL_DB_USER = memento_ro
MYSQL_DB_PWD = memento_ro
MYSQL_DB_NAME = memento_wax
CONNECTION_POOL = 10
DATABASE_SELECT = "MYSQL"
HEALTHY_SYNC_TIME_DIFF = 15000
API_PATH_PREFIX = wax
CPU_CORES = 4
MAX_RECORD_COUNT = 100
WS_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD = 100
WS_TRACE_TRANSACTIONS_LIMIT = 100
WS_EVENTLOG_TRANSACTIONS_LIMIT = 100
EOT

systemctl enable memento_api@wax
systemctl start memento_api@wax

# example for a WAX Postgres database
cat >/etc/opt/memento_api_waxpg.env <<'EOT'
SERVER_BIND_IP = 127.0.0.1
SERVER_BIND_PORT = 3002
POSTGRES_DB_HOST = 10.0.3.211
POSTGRES_DB_PORT = 5432
POSTGRES_DB_USER = memento_ro
POSTGRES_DB_PWD = memento_ro
POSTGRES_DB_NAME = memento_wax
CONNECTION_POOL = 10
DATABASE_SELECT = "POSTGRES"
HEALTHY_SYNC_TIME_DIFF = 15000
API_PATH_PREFIX = waxpg
CPU_CORES = 4
MAX_RECORD_COUNT = 100
WS_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD = 100
WS_TRACE_TRANSACTIONS_LIMIT = 100
WS_EVENTLOG_TRANSACTIONS_LIMIT = 100
EOT

systemctl enable memento_api@waxpg
systemctl start memento_api@waxpg
```

## Configuration options

```
SERVER_BIND_IP = 0.0.0.0 // Server bind IP address
SERVER_BIND_PORT = 12345 // Server bind port

MYSQL_DB_HOST = ----  //MYSQL DB host name
MYSQL_DB_PORT = ----  //MYSQL DB port
MYSQL_DB_USER = ----  //MYSQL DB username
MYSQL_DB_PWD = ----   //MYSQL DB password
MYSQL_DB_NAME = ----  //MYSQL DB name

POSTGRES_DB_HOST = ---- //POSTGRES DB host name
POSTGRES_DB_PORT = ---- //POSTGRES DB port
POSTGRES_DB_USER = ---- //POSTGRES DB username
POSTGRES_DB_PWD = ----  //POSTGRES DB password
POSTGRES_DB_NAME = ---- //POSTGRES DB name

CONNECTION_POOL = 10            // DB max connection pool size
DATABASE_SELECT = "MYSQL"       // Specify which Db type to select MYSQL or POSTGRES
HEALTHY_SYNC_TIME_DIFF = 15000  // Health check sync time interval
API_PATH_PREFIX = wax           // API path prefix wax, eos, tlos

CPU_CORES = 2   // number of cpu cores, value should not exceed max number of cores available in the system

MAX_RECORD_COUNT = 10  // maximum number of records that can be returned in a single request

WS_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD = 100 // maximum number of blocks threshold for which transactions will be emitted from websocket
WS_TRACE_TRANSACTIONS_LIMIT = 100 // maximum number of irreversible transactions which can be emitted from websocket
WS_EVENTLOG_TRANSACTIONS_LIMIT = 100 // maximum number of reversible transactions which can be emitted from websocket

```

# Release history

* Release 2.2: bugfix in using the index in RECEIPTS. Also, returned pos is the maximum position within the transaction.

* Release 2.3: bugfix in number handling.


# Acknowledgments

This work was sponsored by EOS Amsterdam block producer.

Copyright 2023 Raj Kumar (raj.rpt@gmail.com), cc32d9 (cc32d9@gmail.com)

Copyright 2024 [chainza.io](https://chainza.io/): Maks Hladun (maks@chainza.io), Andriy Shymkiv (andriy.sh@chainza.io)
