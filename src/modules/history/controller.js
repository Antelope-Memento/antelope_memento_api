const constant = require("../../constants/config");
const db       = require("../../utilities/db");
const txn      = require("../transactionStatus/controller");

var controller = function(){
};

const sendTraces = async (res, traces) =>
{
  if(traces.length > 0)
  {
    res.status(constant.HTTP_200_CODE);
    res.write('{ data:[');
    traces.forEach((item, i) => {
      res.write('{');
      let strTrace = item.trace.toString('utf8');
      res.write(strTrace);
      if(i < traces.length - 1)
      {
        res.write('},');
      }
      else
      {
        res.write('}');
      }
    });

    res.write(']}');
    res.end();
  }
  else
  {
    res.status(constant.HTTP_500_CODE).send({"errormsg":constant.RECORD_NOT_FOUND});
  }
}

const executeQuery = async (res, query) =>
{
  db.ExecuteQuery(query, async (data)=>{
    if(data.status == 'error')
    {
      console.log(data.msg);
      res.status(constant.HTTP_500_CODE).send({"errormsg":data.msg});
    }
    else
    {
      try {
        await sendTraces(res, data.data);
      }
      catch(e){
        res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DATA_SEND_ERROR});
      }
    }
  });
}

controller.get_account_history = async (req, res)=>{
  let account = req.query["account"];
  let irreversible = req.query["irreversible"];
  let block_num_min = req.query["block_num_min"]   || "";
  let block_num_max = req.query["block_num_max"]   || "";
  let block_time_min = req.query["block_time_min"] || "";
  let block_time_max = req.query["block_time_max"] || "";

  let rec_count = req.query.count || process.env.MAX_RECORD_COUNT;
  if(parseInt(rec_count) > process.env.MAX_RECORD_COUNT)
  {
    rec_count = process.env.MAX_RECORD_COUNT;
  }
  if(irreversible == 'true')
  {
    try {
      let data = await txn.getIrreversibleBlockNumber();
      //  console.log(data);
      if(data.status == 'success')
      {
        if(block_num_max > data.irreversible)
        {
          block_num_max = data.irreversible;
        }
      }
      else
      {
        res.status(constant.HTTP_500_CODE).send({"errormsg":constant.RECORD_NOT_FOUND});
        return;
      }
    }
    catch(e)
    {
      res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DB_READ_ERROR});
      return;
    }
  }

  let query = "select TRANSACTIONS.trace from RECEIPTS LEFT JOIN TRANSACTIONS ON RECEIPTS.seq = TRANSACTIONS.seq \
  where account_name='" + account + "'";

  if(block_num_min != "")
  {
    query = query + " and RECEIPTS.block_num >= " + block_num_min;
  }
  if(block_num_max != "")
  {
    query = query + " and RECEIPTS.block_num <= " + block_num_max;
  }

  if(block_time_min != "")
  {
    query = query + " and RECEIPTS.block_time >= '" + block_time_min + "'";
  }
  if(block_time_max != "")
  {
    query = query + " and RECEIPTS.block_time <= '" + block_time_max + "'";
  }

  query = query + " order by RECEIPTS.seq desc LIMIT " + rec_count;

  //console.log(query);
  executeQuery(res, query);
}

controller.get_contract_history = async (req, res)=>{
  let contract = req.query["contract"];
  let irreversible = req.query["irreversible"];
  let block_num_min = req.query["block_num_min"]   || "";
  let block_num_max = req.query["block_num_max"]   || "";
  let block_time_min = req.query["block_time_min"] || "";
  let block_time_max = req.query["block_time_max"] || "";
  let actions = req.query["actions"] || "";
  let rec_count = req.query.count || process.env.MAX_RECORD_COUNT;
  if(parseInt(rec_count) > process.env.MAX_RECORD_COUNT)
  {
    rec_count = process.env.MAX_RECORD_COUNT;
  }

  let strAction = "";
  if(actions != "")
  {
    let listAction = actions.split(',');
    strAction = "(";
    listAction.forEach((item, i) => {
      if(i > 0)
      {
        strAction = strAction + ",";
      }
      strAction =  strAction + "'" + item + "'";
    });

    strAction = strAction + ")";
  }

  if(irreversible == 'true')
  {
    try {
      let data = await txn.getIrreversibleBlockNumber();
      if(data.status == 'success')
      {
        if(block_num_max > data.irreversible)
        {
          block_num_max = data.irreversible;
        }
      }
      else
      {
        res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DB_READ_ERROR});
        return;
      }
    }
    catch(e)
    {
      res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DB_READ_ERROR});
      return;
    }
  }

  let query = "select TRANSACTIONS.trace from ACTIONS LEFT JOIN TRANSACTIONS ON ACTIONS.seq = TRANSACTIONS.seq \
  where contract='" + contract + "'";

  if(block_num_min != "")
  {
    query = query + " and ACTIONS.block_num >= " + block_num_min;
  }
  if(block_num_max != "")
  {
    query = query + " and ACTIONS.block_num <= " + block_num_max;
  }

  if(block_time_min != "")
  {
    query = query + " and ACTIONS.block_time >= '" + block_time_min + "'";
  }
  if(block_time_max != "")
  {
    query = query + " and ACTIONS.block_time <= '" + block_time_max + "'";
  }
  if(strAction != "")
  {
    query = query + " and ACTIONS.action IN " + strAction;
  }

  query = query + " order by ACTIONS.seq LIMIT " + rec_count;

  //console.log(query);
  executeQuery(res, query);
}

module.exports = controller;
