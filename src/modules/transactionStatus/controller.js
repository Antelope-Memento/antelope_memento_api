const constant = require("../../constants/config");
const db       = require("../../utilities/db");

var controller = function(){
};

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
            let status = 'irreversible';
            if(rec.block_num > data.irreversible)
            {
              status = 'reversible';
            }
            res.status(constant.HTTP_200_CODE).send({status:status, block_num:rec.block_num, block_time:rec.block_time, trace: rec.trace});
          }
          else
          {
            res.status(constant.HTTP_500_CODE).send({"errormsg":'Unable to read db'});
          }
        });
      }
      else
      {
        res.status(constant.HTTP_200_CODE).send({status:'unknown', "errormsg":'Record not found'});
      }
    }
  });
}

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
            let status = 'irreversible';
            if(rec.block_num > data.irreversible)
            {
              status = 'reversible';
            }
            res.status(constant.HTTP_200_CODE).send({status:status, block_num:rec.block_num, block_time:rec.block_time});
          }
          else
          {
            res.status(constant.HTTP_500_CODE).send({"errormsg":'Unable to read db'});
          }
        });
      }
      else
      {
        res.status(constant.HTTP_200_CODE).send({status:'unknown', "errormsg":'Record not found'});
      }
    }
  });
}

module.exports = controller;
