var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');

const healthController = require("../../src/modules/health/controller.js");

var graphql = function(){
};

// Construct a schema, using GraphQL schema language
graphql.schema = buildSchema(`
  type health_status {
    status: Boolean!
    msg: String!
          },
  type Query {
    health: health_status
  }
`);

// resolver function for each API endpoint
graphql.resolver = {
  health: async function () {
    let retVal = await healthController.getHealthStatus();
    return {status: retVal.status, msg: retVal.errormsg} ;
  }
};

module.exports = graphql;
