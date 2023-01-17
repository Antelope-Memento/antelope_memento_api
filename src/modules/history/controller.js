const constant = require("../../constants/config");
const db       = require("../../utilities/db");
const txn      = require("../transactionStatus/controller");

var controller = function(){
};

controller.get_account_history = async (req, res)=>{
  let account = req.query["account"];
  let irreversible = req.query["irreversible"];
  let block_num_min = req.query["block_num_min"];
  let block_num_max = req.query["block_num_max"];
  let block_time_min = req.query["block_time_min"];
  let block_time_max = req.query["block_time_max"];

  if(irreversible == 'true')
  {
    console.log('irreversible true');
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
    where account_name='" + account + "' and RECEIPTS.block_num >= " + block_num_min + " and RECEIPTS.block_num <= \
    " + block_num_max + " and RECEIPTS.block_time >= '" + block_time_min + "' and RECEIPTS.block_time <= '" + block_time_max + "'";

    db.ExecuteQuery(query, (data)=>{
      if(data.status == 'error')
      {
        console.log(data.msg);
        res.status(constant.HTTP_500_CODE).send({"errormsg":data.msg});
      }
      else
      {
        if(data.data.length > 0)
        {
          res.status(constant.HTTP_200_CODE).send({data: data.data});
        }
        else
        {
          res.status(constant.HTTP_500_CODE).send({"errormsg":constant.RECORD_NOT_FOUND});
        }
      }
    });
}

controller.get_contract_history = async (req, res)=>{
  let contract = req.query["contract"];
  let irreversible = req.query["irreversible"];
  let block_num_min = req.query["block_num_min"];
  let block_num_max = req.query["block_num_max"];
  let block_time_min = req.query["block_time_min"];
  let block_time_max = req.query["block_time_max"];
  let actions = req.query["actions"];

  let listAction = actions.split(',');
  let strAction = "(";
  listAction.forEach((item, i) => {
    if(i > 0)
    {
      strAction = strAction + ",";
    }
    strAction =  strAction + "'" + item + "'";
  });

  strAction = strAction + ")";

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
  where contract='" + contract + "' and ACTIONS.block_num >= " + block_num_min + " and ACTIONS.block_num <= \
  " + block_num_max + " and ACTIONS.block_time >= '" + block_time_min + "' and ACTIONS.block_time <= '" + block_time_max + "' and ACTIONS.action IN " + strAction;

  //console.log(query);

  db.ExecuteQuery(query, (data)=>{
    if(data.status == 'error')
    {
      console.log(data.msg);
      res.status(constant.HTTP_500_CODE).send({"errormsg":data.msg});
    }
    else
    {
      if(data.data.length > 0)
      {
          res.status(constant.HTTP_200_CODE).send({data: data.data});
      }
      else
      {
        res.status(constant.HTTP_500_CODE).send({"errormsg":constant.RECORD_NOT_FOUND});
      }
    }
  });
}

module.exports = controller;
