module.exports = {
    env: {
      es2021: true,
      node: true,
      jest: true,
    },
    extends: ["eslint:recommended", "plugin:security/recommended", "plugin:sonarjs/recommended"],
    plugins: ["security", "sonarjs"],
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {},
  };
  