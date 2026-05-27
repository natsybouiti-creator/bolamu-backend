module.exports = {
  env: { node: true, es2021: true, jest: true },
  extends: ['eslint:recommended', 'plugin:security/recommended'],
  plugins: ['security'],
  rules: {
    'no-console': 'warn',
    'security/detect-sql-injection': 'error',
    'security/detect-non-literal-require': 'warn'
  }
};
