var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');

const healthController = require("../../src/modules/health/controller.js");
const txnController    = require("../../src/modules/transactionStatus/controller.js");
const historyController    = require("../../src/modules/history/controller.js");

const FormatError = require('easygraphql-format-error');
const { GraphQLJSON, GraphQLJSONObject } = require('graphql-type-json');
const constant = require("../constants/config");

var graphql = function(){
};

const formatError = new FormatError(
  constant.errors
);
const errorName = formatError.errorName
//console.log(errorName);

// Construct a schema, using GraphQL schema language
graphql.schema = buildSchema(`
  scalar GraphQLJSON

  type health_status {
    status: Boolean!,
    msg: String!
  },
  type transaction_status {
    known: Boolean!,
    irreversible: Boolean!,
    block_num: String!,
    block_time: String!,
    data: GraphQLJSON!
  },
  type history_data {
    last_irreversible_block: Int!,
    data:[GraphQLJSON]!
  },
  type Query {
    health: health_status,

    account_history(account: String!, irreversible: Boolean, block_num_min: Int, block_num_max: Int,
      block_time_min: String, block_time_max: String, count: Int): history_data,

    contract_history(contract: String!, irreversible: Boolean, block_num_min: Int, block_num_max: Int,
      block_time_min: String, block_time_max: String, actions: String, count: Int): history_data,

      transaction(trx_id: String!): transaction_status
    }`
  );

  // resolver function for each API endpoint
  graphql.resolver = {
    health: async function () {
      let retVal = await healthController.getHealthStatus();
      return {status: retVal.status, msg: retVal.errormsg} ;
    },
    account_history: async (args)=> {
      let retVal = await historyController.execute_account_history(args);
      // console.log(retVal);
      if(retVal.code == 200)
      {
        for(let i = 0; i < retVal.data.length; i++)
        {
          retVal.data[i].trace = JSON.parse(retVal.data[i].trace);
        }
        return {last_irreversible_block: retVal.irreversibleBlock, data:retVal.data} ;
      }
      else
      {
        if(retVal.code == constant.HTTP_500_CODE)
        {
          throw new Error(errorName.DB_READ_ERR);
        }
        else if(retVal.code == constant.VALIDATION_ERR_INVALID_ACCOUNT)
        {
          throw new Error(errorName.ACCOUNT_NAME_INVALID);
        }
        else if(retVal.code == constant.VALIDATION_ERR_INVALID_TIME_MIN)
        {
          throw new Error(errorName.TIME_MIN_INVALID);
        }
        else if(retVal.code == constant.VALIDATION_ERR_INVALID_TIME_MAX)
        {
          throw new Error(errorName.TIME_MAX_INVALID);
        }
      }
    },
    contract_history: async (args)=> {
      let retVal = await historyController.execute_contract_history(args);
      //console.log(retVal);

      if(retVal.code == constant.HTTP_200_CODE)
      {
        for(let i = 0; i < retVal.data.length; i++)
        {
          retVal.data[i].trace = JSON.parse(retVal.data[i].trace);
        }
        return {last_irreversible_block: retVal.irreversibleBlock, data:retVal.data} ;
      }
      else
      {
        if(retVal.code == constant.HTTP_500_CODE)
        {
          throw new Error(errorName.DB_READ_ERR);
        }
        else if(retVal.code == constant.VALIDATION_ERR_INVALID_CONTRACT)
        {
          throw new Error(errorName.CONTRACT_NAME_INVALID);
        }
        else if(retVal.code == constant.VALIDATION_ERR_INVALID_TIME_MIN)
        {
          throw new Error(errorName.TIME_MIN_INVALID);
        }
        else if(retVal.code == constant.VALIDATION_ERR_INVALID_TIME_MAX)
        {
          throw new Error(errorName.TIME_MAX_INVALID);
        }
        else if(retVal.code == constant.VALIDATION_ERR_INVALID_ACTION)
        {
          throw new Error(errorName.ACTION_NAME_INVALID);
        }
      }
    },
    transaction: async (args)=> {
    let trx_id = args["trx_id"] || "";
    if(trx_id == '')
    {
      throw new Error(errorName.TRX_ID_INVALID);
      return;
    }

    let retVal = await txnController.getTransactionInfo(args.trx_id);
    if(retVal.code == constant.HTTP_200_CODE)
    {
      if(retVal.errormsg == "")
      {
        let obj = JSON.parse(retVal.data);
        if(obj.length > 0)
        {
          return {known: retVal.known, irreversible: false, block_num:retVal.block_num,
            block_time:retVal.block_time, data:obj};
          }
          else
          {
            throw new Error(errorName.DB_READ_ERR);
          }
        }
        else
        {
          return {known: retVal.known, irreversible: false, block_num:retVal.block_num,
          block_time:retVal.block_time, data:[]};
        }
      }
      else
      {
        throw new Error(errorName.DB_READ_ERR);
      }
    },
  };

module.exports = graphql;
