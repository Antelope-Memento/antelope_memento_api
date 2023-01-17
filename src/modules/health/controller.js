const constant = require("../../constants/config");
const db       = require("../../utilities/db");

var controller = function(){
};

controller.health = async (req, res)=>{
  let query = "select block_time from SYNC";
  db.ExecuteQuery(query, (data)=>{
    if(data.status == 'error')
    {
      console.log(data.msg);
      res.status(constant.HTTP_500_CODE).send({"msg":data.msg});
    }
    else
    {
      if(data.data.length > 0)
      {
        let rec = data.data[0];
        let block_time = new Date(rec.block_time);

        var now = new Date();
        var now_utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
        let timeDiff = now_utc.getTime() - block_time.getTime();

      //  console.log(now_utc.toISOString());
    //    console.log(dt.toISOString());
      //  console.log('time diff ' + timeDiff);

        if(timeDiff <= process.env.HEALTHY_SYNC_TIME_DIFF)
        {
          res.status(constant.HTTP_200_CODE).send({"msg": constant.MSG_HEALTHY});
        }
        else
        {
          res.status(constant.HTTP_503_CODE).send({"msg":'The data was updated ' + Math.round(timeDiff / 1000) + ' seconds ago'});
        }
      }
      else
      {
        res.status(constant.HTTP_500_CODE).send({"msg":constant.RECORD_NOT_FOUND});
      }
    }
  });
}

controller.is_healthy = async (req, res)=>{
  let query = "select block_time from SYNC";
  db.ExecuteQuery(query, (data)=>{
    if(data.status == 'error')
    {
      console.log(data.msg);
      res.status(constant.HTTP_500_CODE).send({status:false, "errormsg":data.msg});
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
          res.status(constant.HTTP_200_CODE).send({status:true, "errormsg":constant.MSG_HEALTHY});
        }
        else
        {
          res.status(constant.HTTP_503_CODE).send({status:false, "errormsg":'The data was updated ' + Math.round(timeDiff / 1000) + ' seconds ago'});
        }
      }
      else
      {
        res.status(constant.HTTP_500_CODE).send({status:false, "errormsg":constant.RECORD_NOT_FOUND});
      }
    }
  });
}

module.exports = controller;
