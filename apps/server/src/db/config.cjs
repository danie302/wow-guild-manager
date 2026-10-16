// sequelize-cli connection settings. Every environment reads DATABASE_URL,
// which docker-compose.yml sets (and the test setup points at the test database).
const settings = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
};

module.exports = {
  development: settings,
  test: settings,
  production: settings,
};
