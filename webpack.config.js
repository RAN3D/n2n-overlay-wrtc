module.exports = {
  mode: 'development',
  entry: './lib/n2n-overlay.js',
  output: {
    'path': require('path').resolve(process.cwd(), 'build'),
    'filename': 'n2n-overlay-wrtc.bundle.debug.js',
    'library': 'N2N',
    'libraryTarget': 'umd',
    'umdNamedDefine': true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: () => {
          return true
        },
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ 'env' ]
          }
        }
      }
    ]
  },
  devtool: 'source-map'
}
