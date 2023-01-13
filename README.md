# MementoAPI Details


## Run locally

1. Clone this repository
1. Create .env file in root dir using example.env file with proper values
1. Run from root dir using following commands

```
npm update
npm start

```

Server start listening on the given port number

Presently there is two APIs
## API 1
url: http://localhost:54321/api/is_healthy
Method: /is_healthy ( GET )

Response JSON: returns the execution result as below

```
{
  "status": true,
  "errormsg": "Healthy"
}
```

## API 2
url: http://localhost:54321/api/health
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
 
