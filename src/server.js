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

app.use("/api", router);

app.get("/api", (req, res) => {
  res.send("welcome to Memento apis");
});

dbUtility.CreateConnectionPool();

var port = process.env.SERVER_BIND_PORT_1 || 12345;
var bind_ip = process.env.SERVER_BIND_IP_1 || '0.0.0.0';
if(process.env.SERVER_BIND_SELECT ==  2)
{
  port = process.env.SERVER_BIND_PORT_2 || 54321;
  bind_ip = process.env.SERVER_BIND_IP_2 || '127.0.0.1';
}

app.listen(port, bind_ip, () => {
  console.log(`listening on port no ${port}`);
});

module.exports = app;
