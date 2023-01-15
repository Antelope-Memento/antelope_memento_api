const constant = require("../../constants/config");
const db       = require("../../utilities/db");

var controller = function(){
};

controller.get_transaction = async (req, res)=>{
  let trx_id = req.query["trx_id"];

  let query = "select block_num, block_time, trace from TRANSACTIONS where trx_id='" + trx_id + "'";
  console.log(query);
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

        let str = Buffer.from(rec.trace, 'utf');
      //  console.log(str.toString());
        let trace_obj = JSON.parse(str.toString());
        let status = trace_obj.trace.status;
        res.status(constant.HTTP_200_CODE).send({status:status, block_num:rec.block_num, block_time:rec.block_time, trace: rec.trace});
      }
      else
      {
        res.status(constant.HTTP_500_CODE).send({"errormsg":'Record not found'});
      }
    }
  });
}

controller.get_transaction_status = async (req, res)=>{

  let trx_id = req.query["trx_id"];

  let query = "select block_num, block_time, trace from TRANSACTIONS where trx_id='" + trx_id + "'";
  console.log(query);
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
        let str = Buffer.from(rec.trace, 'utf');
      //  console.log(str.toString());
        let trace_obj = JSON.parse(str.toString());
        let status = trace_obj.trace.status;

        res.status(constant.HTTP_200_CODE).send({status:status, block_num:rec.block_num, block_time:rec.block_time});
      }
      else
      {
        res.status(constant.HTTP_500_CODE).send({"errormsg":'Record not found'});
      }
    }
  });
}

module.exports = controller;
