var path = require("path");
var webpack = require("webpack");

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
    new webpack.optimize.UglifyJsPlugin({
      compressor: {
        warnings: false,
        screw_ie8: false
      }
    }),
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)
    })
  ],
  module: {
    loaders: [
      {
        test: /\.js?$/,
        exclude: /node_modules/,
        include: [
          path.resolve(__dirname, "test"),
          path.resolve(__dirname, "src")
        ],
        loader: "babel"
      }
    ]
  }
};
