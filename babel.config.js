module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Inlines the generated Drizzle migration's .sql imports as string
    // literals at build time — see https://orm.drizzle.team/quick-sqlite/expo.
    plugins: [["inline-import", { extensions: [".sql"] }]],
  };
};
