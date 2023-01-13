const constant = require("../../constants/config");
const db       = require("../../utilities/db");

const healthy_sync_diff = 20000; // milli sec

var controller = function(){
};

controller.health = async (req, res)=>{
  let query = "select last_updated from SYNC";
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
        console.log(rec.last_updated);
        let dt = new Date(rec.last_updated);
        let dt1 = new Date();
        let timeDiff = dt1.getTime() - dt.getTime();
        console.log('time diff ' + timeDiff);

        if(timeDiff <= healthy_sync_diff)
        {
          res.status(constant.HTTP_200_CODE).send({"msg":'Healthy'});
        }
        else
        {
          res.status(constant.HTTP_503_CODE).send({"msg":'The data was updated ' + Math.round(timeDiff / 1000) + ' seconds ago'});
        }
      }
      else
      {
        res.status(constant.HTTP_500_CODE).send({"msg":'Record not found'});
      }
    }
  });
}

controller.is_healthy = async (req, res)=>{
  let query = "select last_updated from SYNC";
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
        console.log(rec.last_updated);
        let dt = new Date(rec.last_updated);
        let dt1 = new Date();
        let timeDiff = dt1.getTime() - dt.getTime();
        console.log('time diff ' + timeDiff);

        if(timeDiff <= healthy_sync_diff)
        {
          res.status(constant.HTTP_200_CODE).send({status:true, "errormsg":'Healthy'});
        }
        else
        {
          res.status(constant.HTTP_503_CODE).send({status:false, "errormsg":'The data was updated ' + Math.round(timeDiff / 1000) + ' seconds ago'});
        }
      }
      else
      {
        res.status(constant.HTTP_500_CODE).send({status:false, "errormsg":'Record not found'});
      }
    }
  });
}

module.exports = controller;
