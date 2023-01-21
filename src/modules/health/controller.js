const constant = require("../../constants/config");
const db       = require("../../utilities/db");

var controller = function(){
};

controller.getHealthStatus = async ()=>{
  return new Promise((resolve) => {
    let query = "select block_time from SYNC";
    db.ExecuteQuery(query, (data)=>{
      if(data.status == 'error')
      {
        console.log(data.msg);
        resolve({status:false, "errormsg":data.msg, code:constant.HTTP_500_CODE });
      }
      else
      {
        if(data.data.length > 0)
        {
          let rec = data.data[0];
          //  console.log(rec);
          //  console.log(rec.block_time);
          let block_time = new Date(rec.block_time);
          var now = new Date();
          var now_utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
          let timeDiff = now_utc.getTime() - block_time.getTime();
          //    console.log('time diff ' + timeDiff);

          if(timeDiff <= process.env.HEALTHY_SYNC_TIME_DIFF)
          {
            resolve({status:true, "errormsg":constant.MSG_HEALTHY, code:constant.HTTP_200_CODE });
          }
          else
          {
            resolve({status:false, "errormsg":'The data was updated ' + Math.round(timeDiff / 1000) + ' seconds ago', code:constant.HTTP_503_CODE });
          }
        }
        else
        {
          resolve({status:false, "errormsg":constant.RECORD_NOT_FOUND, code:constant.HTTP_500_CODE });
        }
      }
    });
  });
}

controller.health = async (req, res)=>{
  try {
    let retVal = await controller.getHealthStatus();
    res.status(retVal.code).send({"msg":retVal.errormsg});
  }
  catch(e)
  {
    res.status(constant.HTTP_500_CODE).send({"msg":constant.DB_READ_ERROR});
  }
}

controller.is_healthy = async (req, res)=>{
  try {
    let retVal = await controller.getHealthStatus();
    res.status(retVal.code).send({status: retVal.status, "errormsg":retVal.errormsg});
  }
  catch(e)
  {
    res.status(constant.HTTP_500_CODE).send({status:false, "errormsg":constant.DB_READ_ERROR});
  }
}

module.exports = controller;
