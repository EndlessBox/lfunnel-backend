module.exports = (sequelize, Sequelize) => {
  const UserInfo = sequelize.define("userInfo", {
    accessToken: {
      type: Sequelize.STRING,
    },
    accountId: {
      type: Sequelize.INTEGER,
    },
    klavPrivateKey: {
      type: Sequelize.STRING,
    },
    klavPublicKey: {
      type: Sequelize.STRING,
    },
  });
  return UserInfo;
};
