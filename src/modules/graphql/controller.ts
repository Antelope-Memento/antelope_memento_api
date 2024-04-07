import { createHandler } from 'graphql-http/lib/use/express';
import { makeExecutableSchema } from '@graphql-tools/schema';

import * as txnController from '../transactionStatus/controller';
import * as historyController from '../history/controller';
import { AccountHistoryQuery, GetPosQuery } from '../history/types';

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

    get_pos(account: String!, timestamp: String!): String,

    transaction(trx_id: String!): transaction_status
  }`;

// resolver function for each API endpoint
const resolvers = {
    async account_history(_obj: unknown, args: AccountHistoryQuery) {
        try {
            return await historyController.graphQlAccountHistory(args);
        } catch (err) {
            console.error((err as Error)?.message);
            throw err;
        }
    },

    async get_pos(_obj: unknown, args: GetPosQuery) {
        try {
            return await historyController.graphQlGetPos(args);
        } catch (err) {
            console.error((err as Error)?.message);
            throw err;
        }
    },

    async transaction(_obj: unknown, args: { trx_id: string }) {
        try {
            return await txnController.graphQlGetTransaction(args.trx_id);
        } catch (err) {
            console.error((err as Error)?.message);
            throw err;
        }
    },
};

const schema = makeExecutableSchema({
    typeDefs: sdlSchema,
    resolvers: {
        Query: resolvers,
    },
});

export default createHandler({
    schema,
});
