const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");
const cluster = require('cluster');

var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');
const FormatError = require('easygraphql-format-error');

require("dotenv").config();

const router    = require("./routes/routes");
const dbUtility = require("./utilities/db");
const graph_ql = require("./utilities/graph_ql");
const constant = require("./constants/config");

const app      = express();

const required_options = ['SERVER_BIND_IP', 'SERVER_BIND_PORT', 'DATABASE_SELECT', 'HEALTHY_SYNC_TIME_DIFF',
'API_PATH_PREFIX', 'CPU_CORES', 'MAX_RECORD_COUNT', 'CONNECTION_POOL'];

required_options.forEach((item, i) => {
  if( process.env[item] === undefined ) {
    console.error(`Environment option ${item} is not defined`);
    process.exit(1);
  }
});

app.use(cors({
  origin: "*",
}));

app.use(morgan(':method :url :status :res[content-length] - :response-time ms :remote-addr'));
app.use(express.json());

app.use(`/${process.env.API_PATH_PREFIX}`, router);

app.get(`/${process.env.API_PATH_PREFIX}`, (req, res) => {
  res.send("welcome to Memento apis");
});

dbUtility.CreateConnectionPool();

var port = process.env.SERVER_BIND_PORT || 12345;
var bind_ip = process.env.SERVER_BIND_IP || '0.0.0.0';

const formatError = new FormatError(constant.errors);
const errorName = formatError.errorName

const loggingMiddleware = (req, res, next) => {
  console.log('GraphQL req.body: ', JSON.stringify(req.body));
  next();
}

app.use(loggingMiddleware);
app.use(`/${process.env.API_PATH_PREFIX}/graphql`, graphqlHTTP({
  schema: graph_ql.schema,
  rootValue: graph_ql.resolver,
  graphiql: true,
  context: { errorName },
    customFormatErrorFn: (err) => {
      let obj = formatError.getError(err);
      return obj;
    }
}));

createClusteredServer(bind_ip, port, process.env.CPU_CORES);

//create clustered server and bind with specified ip address and port number
function createClusteredServer(ip, port, clusterSize)
{
  if(clusterSize > 1)
  {
    if (cluster.isMaster) {
      console.log(`Master ${process.pid} is running`);

      // Fork workers.
      for (let i = 0; i < clusterSize; i++) {
        cluster.fork();
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
        if(signal == 'SIGKILL')
        {
          gracefulExit();
          process.exit(0);
        }
        else
        {
          cluster.fork();
        }
        console.log('Starting a new worker ');
      });
    } else {
      app.listen(port, ip, () => {
        console.log(`listening on port no ${port}`);
      });
      console.log(`Worker ${process.pid} started`);
    }
  }
  else
  {
    app.listen(port, ip, () => {
      console.log(`listening on port no ${port}`);
    });
  }
}


var gracefulExit = function() {
  console.log('Close DB connection');
  dbUtility.CloseConnection();
  process.exit(0);
}

// If the Node process ends, close the DB connection
process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);

process.on('uncaughtException', function(error) {
  console.log('uncaughtException ' + error);
});

process.on('unhandledRejection', function(reason, p){
  console.log('unhandledRejection ' + reason);
});

module.exports = app;
