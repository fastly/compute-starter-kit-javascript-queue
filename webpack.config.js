import path from "path";
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";

export default {
  entry: "./src/index.js",
  optimization: {
    minimize: true,
  },
  target: "webworker",
  output: {
    filename: 'index.cjs',
    path: path.resolve(import.meta.dirname, "bin"),
    chunkFormat: 'commonjs',
    library: {
      type: 'commonjs',
    },
  },
  module: {
    // Loaders go here.
    // e.g., ts-loader for TypeScript
    // rules: [
    // ],
  },
  plugins: [
    // Polyfills go here.
    // Used for, e.g., any cross-platform WHATWG,
    // or core nodejs modules needed for your application.
    new NodePolyfillPlugin({
      excludeAliases: ["console"],
    }),
  ],
  externals: [
    // Allow webpack to handle 'fastly:*' namespaced module imports by treating
    // them as modules rather than trying to process them as URLs
    /^fastly:.*$/,
  ],
};
