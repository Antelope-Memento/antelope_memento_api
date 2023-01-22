const constant = require("../../constants/config");
const db       = require("../../utilities/db");
const txn      = require("../transactionStatus/controller");

var controller = function(){
};

const sendTraces = async (res, traces, irreversibleBlock) =>
{
  if(traces.length > 0)
  {
    res.status(constant.HTTP_200_CODE);
    res.write('{ \"data\":[');
    traces.forEach((item, i) => {
      res.write(item.trace);
      if(i < traces.length - 1)
      {
        res.write(',');
      }
    });

    res.write('],\"last_irreversible_block\":' + irreversibleBlock);
    res.write('}');
    res.end();
  }
  else
  {
    res.status(constant.HTTP_200_CODE).send({data:[], last_irreversible_block: irreversibleBlock});
  }
}

controller.execute_contract_history = async (obj, contract)=>{
  return new Promise( async (resolve) => {
    try {
      let irreversible = obj["irreversible"] || 'false';
      let block_num_min = obj["block_num_min"]   || "";
      let block_num_max = obj["block_num_max"]   || "";
      let block_time_min = obj["block_time_min"] || "";
      let block_time_max = obj["block_time_max"] || "";
      let actions = obj["actions"] || "";
      let rec_count = obj.count || process.env.MAX_RECORD_COUNT;
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

      let data = await txn.getIrreversibleBlockNumber();
      if(data.status == 'success')
      {
        if(irreversible == 'true')
        {
          if(block_num_max > data.irreversible)
          {
            block_num_max = data.irreversible;
          }
        }

        let query = "select TRANSACTIONS.trace from (select distinct seq from ACTIONS " +
        "where contract='" + contract + "'";

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

        query = query + " order by ACTIONS.seq LIMIT " + rec_count +
        ") as X INNER JOIN TRANSACTIONS ON X.seq = TRANSACTIONS.seq";

        db.ExecuteQuery(query, async (db_rec)=>{
          if(db_rec.status == 'error')
          {
            console.log(db_rec.msg);
            resolve({code:constant.HTTP_500_CODE, "errormsg":constant.DB_READ_ERROR });
          }
          else
          {
            resolve({code:constant.HTTP_200_CODE, data: db_rec.data, irreversibleBlock:data.irreversible });
          }
        });
      }
      else
      {
        resolve({code:constant.HTTP_500_CODE, "errormsg":constant.DB_READ_ERROR });
        return;
      }
    }
    catch(e)
    {
      resolve({code:constant.HTTP_500_CODE, "errormsg":constant.DB_READ_ERROR });
      return;
    }
  });
}

controller.execute_account_history = async (obj, account)=>{
  return new Promise(async (resolve) => {
    try {
      let irreversible = obj["irreversible"] || 'false';
      let block_num_min = obj["block_num_min"]   || "";
      let block_num_max = obj["block_num_max"]   || "";
      let block_time_min = obj["block_time_min"] || "";
      let block_time_max = obj["block_time_max"] || "";
      let rec_count = obj.count || process.env.MAX_RECORD_COUNT;
      if(parseInt(rec_count) > process.env.MAX_RECORD_COUNT)
      {
        rec_count = process.env.MAX_RECORD_COUNT;
      }

      let data = await txn.getIrreversibleBlockNumber();

      if(data.status == 'success')
      {
        if(irreversible == 'true')
        {
          if(block_num_max > data.irreversible)
          {
            block_num_max = data.irreversible;
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

        query = query + " order by RECEIPTS.seq LIMIT " + rec_count;

        db.ExecuteQuery(query, async (db_rec)=>{
          if(db_rec.status == 'error')
          {
            console.log(db_rec.msg);
            resolve({code:constant.HTTP_500_CODE, "errormsg":constant.DB_READ_ERROR });
          }
          else
          {
            resolve({code:constant.HTTP_200_CODE, data: db_rec.data, irreversibleBlock:data.irreversible });
          }
        });
      }
      else
      {
        resolve({code:constant.HTTP_500_CODE, "errormsg":constant.DB_READ_ERROR });
        return;
      }
    }
    catch(e)
    {
      resolve({code:constant.HTTP_500_CODE, "errormsg":constant.DB_READ_ERROR });
      return;
    }
  });
}

controller.get_account_history = async (req, res)=>{
  let account = req.query["account"] || "";
  if(account == "")
  {
    res.status(constant.HTTP_400_CODE).send({"errormsg":constant.MSG_INCORRECT_PARAM + ' account'});
    return;
  }
  try {
    let retVal = await controller.execute_account_history(req.query, account);
    if(retVal.code == 200)
    {
      try {
        await sendTraces(res, retVal.data, retVal.irreversibleBlock);
      }
      catch(e){
        res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DATA_SEND_ERROR});
      }
    }
    else
    {
      res.status(retVal.code).send({"errormsg":retVal.errormsg});
    }
  }
  catch(e)
  {
    res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DB_READ_ERROR});
    return;
  }
}

controller.get_contract_history = async (req, res)=>{
  let contract = req.query["contract"] || "";
  if(contract == "")
  {
    res.status(constant.HTTP_400_CODE).send({"errormsg":constant.MSG_INCORRECT_PARAM});
    return;
  }
  try {
    let retVal = await controller.execute_contract_history(req.query, contract);
    if(retVal.code == 200)
    {
      try {
        await sendTraces(res, retVal.data, retVal.irreversibleBlock);
      }
      catch(e){
        res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DATA_SEND_ERROR});
      }
    }
    else
    {
      res.status(retVal.code).send({"errormsg":retVal.errormsg});
    }
  }
  catch(e)
  {
    res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DB_READ_ERROR});
    return;
  }
}

module.exports = controller;
