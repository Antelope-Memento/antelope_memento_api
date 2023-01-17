const constant = require("../../constants/config");
const db       = require("../../utilities/db");

var controller = function(){
};

controller.getIrreversibleBlockNumber = ()=>{

  return new Promise((resolve) => {

    let query = "select irreversible from SYNC";
    db.ExecuteQuery(query, (data)=>{
      if(data.status == 'error')
      {
        console.log(data.msg);
        resolve({status:'error'});
      }
      else
      {
        if(data.data.length > 0)
        {
          let rec = data.data[0];
          resolve({status:'success', irreversible: parseInt(rec.irreversible)});
        }
        else
        {
          resolve({status:'error'});
        }
      }
    });
  });
}

controller.get_transaction = async (req, res)=>{
  let trx_id = req.query["trx_id"];

  let query = "select block_num, block_time, trace from TRANSACTIONS where trx_id='" + trx_id + "'";
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
        let rec = data.data[0];
        controller.getIrreversibleBlockNumber().then( data=>{
          if(data.status == 'success')
          {
            let status = constant.STATUS_IRREVERSIBLE;
            if(rec.block_num > data.irreversible)
            {
              status = constant.STATUS_REVERSIBLE;
            }
            res.status(constant.HTTP_200_CODE).send({status:status, block_num:rec.block_num, block_time:rec.block_time, trace: rec.trace});
          }
          else
          {
            res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DB_READ_ERROR});
          }
        });
      }
      else
      {
        res.status(constant.HTTP_200_CODE).send({status:constant.STATUS_UNKNOWN, "errormsg":constant.RECORD_NOT_FOUND});
      }
    }
  });
}

controller.get_transaction_status = async (req, res)=>{

  let trx_id = req.query["trx_id"];

  let query = "select block_num, block_time, trace from TRANSACTIONS where trx_id='" + trx_id + "'";
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
        let rec = data.data[0];
        controller.getIrreversibleBlockNumber().then(data=>{
          if(data.status == 'success')
          {
            let status = constant.STATUS_IRREVERSIBLE;
            if(rec.block_num > data.irreversible)
            {
              status = constant.STATUS_REVERSIBLE;
            }
            res.status(constant.HTTP_200_CODE).send({status:status, block_num:rec.block_num, block_time:rec.block_time});
          }
          else
          {
            res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DB_READ_ERROR});
          }
        });
      }
      else
      {
        res.status(constant.HTTP_200_CODE).send({status:constant.STATUS_UNKNOWN, "errormsg":constant.RECORD_NOT_FOUND});
      }
    }
  });
}

module.exports = controller;
