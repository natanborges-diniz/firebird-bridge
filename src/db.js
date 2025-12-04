const firebird = require("node-firebird-driver-native");

const options = {
  host: process.env.FIREBIRD_HOST,
  port: Number(process.env.FIREBIRD_PORT || 3050),
  database: process.env.FIREBIRD_DATABASE,
  user: process.env.FIREBIRD_USER,
  password: process.env.FIREBIRD_PASSWORD,
};

async function runQuery(sql, params = []) {
  const attachment = await firebird.createAttachment(options);
  const transaction = await attachment.startTransaction();

  try {
    const resultSet = await attachment.executeQuery(
      transaction,
      sql,
      params
    );

    const rows = await resultSet.fetch();
    await resultSet.close();

    await transaction.commit();
    await attachment.disconnect();

    return rows;
  } catch (error) {
    await transaction.rollback();
    await attachment.disconnect();
    throw error;
  }
}

module.exports = {
  runQuery
};
