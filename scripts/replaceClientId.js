/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Find/replace the clientId with an environment variable.
 * This app requires a user to edit main.ts and hardcode their client id.
 * It also allows a user to set the clientId as an env var for local development and testing.
 * This is an issue when bundling the app for release. backend-webpack-tools and electron-builder do not support build time variables.
 * Therefore, this script edits the transpiled and webpacked main.js and replaces the clientId with the one used for releases.
 * Usage: `node replaceClientId.js path/to/file.js`
 */
var fs = require('fs')

var args = process.argv.slice(2);
if (args.length !== 1)
  return console.error("Provide file name");
var file = args[0];

fs.readFile(file, 'utf8', function (err, data) {
  if (err) {
    return console.error(err);
  }
  var result = data.replace(/process.env.IMJS_ELECTRON_CLIENT_ID/g, JSON.stringify(process.env.IMJS_ELECTRON_CLIENT_ID));

  fs.writeFile(file, result, 'utf8', function (err) {
    if (err) return console.error(err);
  });
});
