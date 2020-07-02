/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";

import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import {
  IModelJsElectronManager, StandardElectronManager, WebpackDevServerElectronManager,
} from "@bentley/electron-manager";
import { IModelHost } from "@bentley/imodeljs-backend";
import { ElectronRpcManager, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { Presentation } from "@bentley/presentation-backend";

import { AppLoggerCategory } from "../common/LoggerCategory";
import { getSupportedRpcs } from "../common/rpcs";

// Setup logging immediately to pick up any logging during IModelHost.startup()
Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Warning);
Logger.setLevel(AppLoggerCategory.Backend, LogLevel.Info);

/**
 * Initializes Electron backend
 */
async function initialize(rpcs: RpcInterfaceDefinition[]) {
  let manager: StandardElectronManager;
  if (process.env.NODE_ENV === "development")
    manager = new WebpackDevServerElectronManager(3000); // port should match the port of the local dev server
  else
    manager = new IModelJsElectronManager(path.join(__dirname, "..", "..", "build"));

  await manager.initialize({
    width: 1280,
    height: 800,
    webPreferences: {
      experimentalFeatures: true, // Needed for CSS Grid support
      nodeIntegration: true,
    },
    autoHideMenuBar: true,
    show: false,
  });
  // tell ElectronRpcManager which RPC interfaces to handle
  ElectronRpcManager.initializeImpl({}, rpcs);
  if (manager.mainWindow) {
    manager.mainWindow.show();
    if (process.env.NODE_ENV === "development")
      manager.mainWindow.webContents.toggleDevTools();
  }
}

(async () => {
  try {
    // Initialize iModelHost
    await IModelHost.startup();

    // Initialize Presentation
    Presentation.initialize();

    // get RPCs supported by this backend
    const rpcs = getSupportedRpcs();
    await initialize(rpcs);

  } catch (error) {
    Logger.logError(AppLoggerCategory.Backend, error);
    process.exitCode = 1;
  }
})(); // tslint:disable-line:no-floating-promises
