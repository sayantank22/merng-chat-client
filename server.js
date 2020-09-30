const { ApolloServer } = require('apollo-server');

require('dotenv').config();

const { sequelize } = require('./models/index');

const resolvers = require('./graphql/resolvers');
const typeDefs = require('./graphql/typeDefs');
const contextMiddleware = require('./util/contextMiddleware');

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: contextMiddleware,
  subscriptions: { path: '/' },
});

server.listen().then(({ url, subscriptionsUrl }) => {
  console.log(`🚀 Server ready at ${url}`);
  console.log(`🚀 Subscription ready at ${subscriptionsUrl}`);

  sequelize
    .authenticate()
    .then(() => console.log('Database Connected!'))
    .catch((err) => console.log(err));
});
