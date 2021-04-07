/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const clientEnv = require("@bentley/react-scripts/config/env")().raw;

if (!clientEnv["IMJS_ELECTRON_TEST_CLIENT_ID"]) {
  let error = new Error();
  error.name = "Missing required environment variable";
  error.message = "Create a new Desktop/Mobile client at https://developer.bentley.com/register. Set client Id as value of IMJS_ELECTRON_TEST_CLIENT_ID variable in .env.local";
  error.stack = "";
  throw error;
}
