const dbConfig = require("../config.json").db;
const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.user,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    operationsAliases: false,
    pool: {
      max: dbConfig.pool.max,
      min: dbConfig.pool.min,
      acquire: dbConfig.pool.acquire,
      idle: dbConfig.pool.idle,
    },
  }
);

const db = {};

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.userInfos = require("./userinfos.model.js")(sequelize, Sequelize);
module.exports = db;
