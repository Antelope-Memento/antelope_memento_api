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

controller.getTransactionInfo = async (trx_id)=>{
  return new Promise((resolve) => {
    let query = "select block_num, block_time, trace from TRANSACTIONS where trx_id='" + trx_id + "'";
    db.ExecuteQuery(query, (data)=>{
      if(data.status == 'error')
      {
        console.log(data.msg);
        resolve({code: constant.HTTP_500_CODE, "errormsg":data.msg, data:[]});
      }
      else
      {
        if(data.data.length > 0)
        {
          let rec = data.data[0];
          controller.getIrreversibleBlockNumber().then( data=>{
            if(data.status == 'success')
            {
              let irreversible = rec.block_num > data.irreversible ? false : true;
              resolve({code: constant.HTTP_200_CODE, known: false, irreversible:irreversible,
                block_num: rec.block_num, block_time: rec.block_time, "errormsg":"", data:rec.trace});
            }
            else
            {
              resolve({code: constant.HTTP_500_CODE, "errormsg":constant.DB_READ_ERROR, data:[]});
            }
          });
        }
        else
        {
          resolve({code: constant.HTTP_200_CODE, known: false, irreversible: false, block_num: 0, block_time:"0", "errormsg":"Record not found", data:[]});
        }
      }
    });
  });
};

controller.get_transaction = async (req, res)=>{
  let trx_id = req.query["trx_id"] || "";

  if(trx_id == "")
  {
    res.status(constant.HTTP_400_CODE).send({"errormsg":constant.MSG_INCORRECT_PARAM + ' trx_id'});
    return;
  }

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
            res.status(constant.HTTP_200_CODE);
            res.write('{\"known\":true, \"irreversible\":' + (rec.block_num > data.irreversible ? 'false':'true') +
            ',\"data\":');
            res.write(rec.trace);
            res.write('}');
            res.end();
          }
          else
          {
            res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DB_READ_ERROR});
          }
        });
      }
      else
      {
        res.status(constant.HTTP_200_CODE).send({known: false});
      }
    }
  });
}

controller.get_transaction_status = async (req, res)=>{

  let trx_id = req.query["trx_id"] || "";

  if(trx_id == "")
  {
    res.status(constant.HTTP_400_CODE).send({"errormsg":constant.MSG_INCORRECT_PARAM + ' trx_id'});
    return;
  }

  let query = "select block_num, block_time from TRANSACTIONS where trx_id='" + trx_id + "'";
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
            res.status(constant.HTTP_200_CODE).send({
              known: true,
              irreversible: (rec.block_num > data.irreversible ? false:true),
              block_num: rec.block_num,
              block_time: rec.block_time});
            }
            else
            {
              res.status(constant.HTTP_500_CODE).send({"errormsg":constant.DB_READ_ERROR});
            }
          });
        }
        else
        {
          res.status(constant.HTTP_200_CODE).send({known: false});
        }
      }
    });
  }

  module.exports = controller;
