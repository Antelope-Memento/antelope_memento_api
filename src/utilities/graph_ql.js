var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');

const healthController = require("../../src/modules/health/controller.js");
const txnController    = require("../../src/modules/transactionStatus/controller.js");
const historyController    = require("../../src/modules/history/controller.js");

const FormatError = require('easygraphql-format-error');
const { GraphQLJSON, GraphQLJSONObject } = require('graphql-type-json');

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
   }`);

// resolver function for each API endpoint
graphql.resolver = {
  health: async function () {
    let retVal = await healthController.getHealthStatus();
    return {status: retVal.status, msg: retVal.errormsg} ;
  },

  account_history: async (args)=> {
    let account = args["account"] || "";
    if(account == "")
    {
      throw new Error(errorName.ACCOUNT_NAME_INVALID);
      return;
    }

    let retVal = await historyController.execute_account_history(args, account);
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
      throw new Error(errorName.DB_READ_ERR);
    }
  },

  contract_history: async (args)=> {
    let contract = args["contract"] || "";
    if(contract == "")
    {
      throw new Error(errorName.CONTRACT_NAME_INVALID);
      return;
    }

    let retVal = await historyController.execute_contract_history(args, contract);
    //console.log(retVal);

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
      throw new Error(errorName.DB_READ_ERR);
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
    // console.log(retVal);
    if(retVal.code == 200)
    {
      let obj = JSON.parse(retVal.data);
      return {known: retVal.known, irreversible: false, block_num:retVal.block_num,
              block_time:retVal.block_time, data:obj};
    }
    else
    {
      throw new Error(errorName.DB_READ_ERR);
    }
  },
};

module.exports = graphql;
