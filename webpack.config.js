const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: {
    ship: path.join(__dirname, "src/index.js"),
  },
  output: {
    path: path.join(__dirname, "/dist/"),
    filename: "[name].js",
    publicPath: "/"
  },
  plugins: [

    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)
    })
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          { loader: "style-loader" },
          { loader: "css-loader" }
        ]
      },
      {
        test: /\.js?$/,
        exclude: /node_modules/,
        include: [
          path.resolve(__dirname, "test"),
          path.resolve(__dirname, "src")
        ],
        use: [
          { loader: "babel-loader" }
        ]
      }
    ]
  }
};
