// @ts-check
const path = require("path")

/** @type {import('webpack').Configuration}*/
module.exports = {
  devtool: "source-map",
  entry: "./src/extension.ts",
  externals: {
    vscode: "commonjs vscode",
  },
  mode: "development",
  module: {
    rules: [
      {
        exclude: /node_modules/,
        loader: "ts-loader",
        test: /\.ts$/,
      },
    ],
  },
  output: {
    devtoolModuleFilenameTemplate: "../[resource-path]",
    filename: "extension.js",
    libraryTarget: "commonjs2",
    path: path.resolve(__dirname, "out"),
  },
  resolve: {
    extensions: [".ts"],
  },
  target: "node",
}
