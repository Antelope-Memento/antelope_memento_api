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

    account_history(account: String!, irreversible: String, block_num_min: Int, block_num_max: Int,
      block_time_min: Int, block_time_max: Int, count: Int): history_data,

      contract_history(contract: String!, irreversible: String, block_num_min: Int, block_num_max: Int,
        block_time_min: Int, block_time_max: Int, actions: String, count: Int): history_data,

        transaction(trx_id: String!): transaction_status
      }
      `);

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

          const regex = new RegExp(/[a-z1-5.]{1,13}/);
          if(regex.test(account) == false)
          {
            throw new Error(errorName.ACCOUNT_NAME_INVALID);
            return;
          }

          var isoRegx = /^(\d{4})(?:-?W(\d+)(?:-?(\d+)D?)?|(?:-(\d+))?-(\d+))(?:[T ](\d+):(\d+)(?::(\d+)(?:\.(\d+))?)?)?(?:Z(-?\d*))?$/;

          let block_time_min = args["block_time_min"] || "";
          let block_time_max = args["block_time_max"] || "";
          if(block_time_min != "")
          {
            if(isoRegx.test(block_time_min) == false)
            {
              throw new Error(errorName.TIME_MIN_INVALID);
              return;
            }
          }
          if(block_time_max != "")
          {
            if(isoRegx.test(block_time_max) == false)
            {
              throw new Error(errorName.TIME_MAX_INVALID);
              return;
            }
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

          const regex = new RegExp(/[a-z1-5.]{1,13}/);
          if(regex.test(contract) == false)
          {
            throw new Error(errorName.CONTRACT_NAME_INVALID);
            return;
          }

          var isoRegx = /^(\d{4})(?:-?W(\d+)(?:-?(\d+)D?)?|(?:-(\d+))?-(\d+))(?:[T ](\d+):(\d+)(?::(\d+)(?:\.(\d+))?)?)?(?:Z(-?\d*))?$/;

          let block_time_min = args["block_time_min"] || "";
          let block_time_max = args["block_time_max"] || "";
          if(block_time_min != "")
          {
            if(isoRegx.test(block_time_min) == false)
            {
              throw new Error(errorName.TIME_MIN_INVALID);
              return;
            }
          }
          if(block_time_max != "")
          {
            if(isoRegx.test(block_time_max) == false)
            {
              throw new Error(errorName.TIME_MAX_INVALID);
              return;
            }
          }

          let actions = args["actions"] || "";
          if(actions != "")
          {
            let listAction = actions.split(',');
            listAction.forEach((item, i) => {
              if(regex.test(item) == false)
              {
                throw new Error(errorName.ACTION_NAME_INVALID);
                return;
              }
            });
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
