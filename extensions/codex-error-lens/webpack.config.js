// @ts-check
'use strict';

const path = require('path');
const FriendlyErrorsWebpackPlugin = require('@soda/friendly-errors-webpack-plugin');

module.exports = (/** @type {any} */ env, /** @type {{ mode: string; }} */ options) => {
	/** @type {import('webpack').Configuration}*/
	const config = {
		target: 'node', // CodeX extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

		entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
		output: { // the bundle is stored in the 'out' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
			path: path.resolve(__dirname, 'out'),
			filename: 'extension.js',
			libraryTarget: 'commonjs2',
			devtoolModuleFilenameTemplate: '../[resource-path]',
		},
		devtool: 'source-map',
		externals: {
			vscode: 'commonjs vscode', // the CodeX vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
		},
		resolve: { // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
			extensions: ['.ts', '.js'],
			alias: {
				"src": path.resolve('./src')
			}
		},
		module: {
			rules: [{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [{
					loader: 'ts-loader',
				}],
			}],
		},
		plugins: [
			new FriendlyErrorsWebpackPlugin(),
		],
	};

	if (options.mode === 'production') {
		config.devtool = false;
	} else {

	}

	return config;
};
