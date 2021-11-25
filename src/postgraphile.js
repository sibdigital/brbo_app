const { postgraphile } = require('postgraphile')
const ConnectionFilterPlugin = require("postgraphile-plugin-connection-filter");
const { NODE_ENV, DATABASE, PG_USER, PASSWORD, HOST, PG_PORT } = process.env
const dbSchema = 'public'
const dbUrl = `postgres://${PG_USER}:${PASSWORD}@${HOST}:${PG_PORT}/${DATABASE}`

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const devOptions = {
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    appendPlugins: [ConnectionFilterPlugin],
    disableQueryLog: true,
/*
    subscriptions: true,
    watchPg: true,
    dynamicJson: true,
    setofFunctionsContainNulls: false,
    ignoreRBAC: false,
    ignoreIndexes: false,
    showErrorStack: "json",
    extendedErrors: ["hint", "detail", "errcode"],
    appendPlugins: [require("@graphile-contrib/pg-simplify-inflector")],
    exportGqlSchemaPath: "schema.graphql",
    graphiql: true,
    enhanceGraphiql: true,
    allowExplain(req) {
        return true;
    },
    enableQueryBatching: true,
    legacyRelations: "omit"
*/
};

const prodOptions = {
    subscriptions: true,
    retryOnInitFail: true,
    dynamicJson: true,
    setofFunctionsContainNulls: false,
    ignoreRBAC: false,
    ignoreIndexes: false,
    extendedErrors: ["errcode"],
    // appendPlugins: [require("@graphile-contrib/pg-simplify-inflector"), ConnectionFilterPlugin],
    appendPlugins: [ConnectionFilterPlugin],
    graphiql: false,
    enableQueryBatching: true,
    disableQueryLog: true, // our default logging has performance issues, but do make sure you have a logging system in place!
    legacyRelations: "omit"
};

const options = NODE_ENV.toString().toLowerCase() === 'development' ? devOptions : prodOptions;

module.exports = postgraphile(
    dbUrl,
    dbSchema,
    options
)
