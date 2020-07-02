/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./index.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { Logger, LogLevel } from "@bentley/bentleyjs-core";

import { AppLoggerCategory } from "../common/LoggerCategory";
import { App } from "./app/App";
import AppComponent from "./components/AppComponent";

// Setup logging immediately to pick up any logging during App.startup()
Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Warning);
Logger.setLevel(AppLoggerCategory.Frontend, LogLevel.Info);

(async () => {
  // Start the app.
  await App.startup();

  // when initialization is complete, render
  ReactDOM.render(
    <AppComponent />,
    document.getElementById("root") as HTMLElement,
  );
})(); // tslint:disable-line:no-floating-promises
