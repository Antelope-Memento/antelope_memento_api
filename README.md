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

Returns a JSON object with `status` and `diff` fields.  Status is
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

Mandatory argument: `account`.

Optional arguments:

* `irreversible` (boolean): if set to true, the result will only contain irreversible transactions.

* `block_num_min` (uint): starting block number. If not specified, the
  API searches from the earliest available block.

* `block_num_max` (uint): ending block number.

* `block_time_min` (DATETIME), `block_time_max` (DATETIME): starting
  and ending timestamp in ISO 8601 format in UTC zone
  (e.g. "2007-04-05T14:30")

* `count` (uint): maximum number of records. The result is also
  limited by MAX_RECORD_COUNT configuration setting, so the count
  parameter may reduce the output if desired.

The call returns a JSON object with the fields
`last_irreversible_block` (uint) and `data` (array of traces). The
array is empty if nothing is found.


### `get_contract_history`

The contract is similar to `/get_account_history`, but it returns all
traces relevant to a smart contract.

Mandatory argument: `contract`.

Optional arguments same as in `/get_account_history`, plus:

* `actions` (string): comma-separated list of contract actions. If
  defined, the output will be filtered accordingly.



## GraphQL API

The GraphQL interface is accessible at `/graphql` location from the
base URL (e.g. `https://memento.eu.eosamsterdam.net/wax/graphql`). It
allows performing the same requests as in the RESTful API.


### Types

* `transaction_status`:
  - `known: Boolean!`
  - `irreversible: Boolean`
  - `block_num: Int`
  - `block_time: String`
  - `data: GraphQLJSON`

* `history_data`:
  - `last_irreversible_block: Unsigned Int!`
  - `data: [GraphQLJSON]!`

### Queries

The following queries are supported:

* `account_history`: returns `history_data`
  - `account: String!`
  - `irreversible: Boolean`
  - `block_num_min: Int`
  - `block_num_max: Int`
  - `block_time_min: String`
  - `block_time_max: String`
  - `count: Int`

* `contract_history`: returns `history_data`
  - `contract: String!`
  - `irreversible: Boolean`
  - `block_num_min: Int`
  - `block_num_max: Int`
  - `block_time_min: String`
  - `block_time_max: String`
  - `count: Int`

* `transaction`: returns transaction_status
  - `trx_id: String!`




## Installation

```
# install Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# get the API
git clone https://github.com/Antelope-Memento/antelope_memento_api.git /opt/antelope_memento_api
cd /opt/antelope_memento_api
npm ci
cp systemd/memento_api\@.service /etc/systemd/system/

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
EOT

systemctl enable memento_api@waxpg
systemctl start memento_api@waxpg
```

## Configuration

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

```



# Acknowledgments
This work was sponsored by EOS Amsterdam block producer.

Copyright 2023 Raj Kumar (raj.rpt@gmail.com), cc32d9 (cc32d9@gmail.com)
