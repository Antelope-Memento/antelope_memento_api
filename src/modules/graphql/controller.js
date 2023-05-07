const {
    createHandler
} = require('graphql-http/lib/use/express');
const {
    buildSchema
} = require('graphql');
const {
    makeExecutableSchema
} = require('@graphql-tools/schema');

const txnController = require("../transactionStatus/controller.js");
const historyController = require("../history/controller.js");

const {
    GraphQLJSON,
    GraphQLJSONObject
} = require('graphql-type-json');
const constant = require("../../constants/config");

var graphql = function() {};

// Construct a schema, using GraphQL schema language
const sdlSchema = `
  schema {
    query: Query
  },

  scalar GraphQLJSON,

  type transaction_status {
    known: Boolean!,
    irreversible: Boolean,
    block_num: Int,
    block_time: String,
    data: GraphQLJSON
  },

  type history_data {
    last_irreversible_block: Int!,
    data:[GraphQLJSON]!
  },

  type Query {
    account_history(account: String!, irreversible: Boolean, max_count: Int, pos: String,
      action_filter: String): history_data,

    transaction(trx_id: String!): transaction_status
  }`;

// resolver function for each API endpoint
const resolvers = {
    async account_history(obj, args, context, info) {
        try {
            return await historyController.graphql_account_history(args);
        } catch (err) {
            console.error(err.message);
            throw err;
        }
    },

    async transaction(obj, args, context, info) {
        try {
            return await txnController.graphql_get_transaction(args.trx_id);
        } catch (err) {
            console.error(err.message);
            throw err;
        }
    },
};

const schema = makeExecutableSchema({
    typeDefs: sdlSchema,
    resolvers: {
        Query: resolvers
    }
});

module.exports = createHandler({
    schema
});
