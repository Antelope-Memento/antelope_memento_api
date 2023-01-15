const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");

require("dotenv").config();

const router    = require("./routes/routes");
const dbUtility = require("./utilities/db");

const app      = express();

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

app.listen(port, bind_ip, () => {
  console.log(`listening on port no ${port}`);
});

module.exports = app;
