/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { dialog, ipcMain } from "electron";
import * as path from "path";
import * as minimist from "minimist";
import { assert, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { ElectronManagerOptions, IModelJsElectronManager, WebpackDevServerElectronManager } from "@bentley/electron-manager";
import { ApplicationType, IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { ElectronRpcManager } from "@bentley/imodeljs-common";
import { Presentation } from "@bentley/presentation-backend";
import { AppLoggerCategory } from "../common/LoggerCategory";
import { appIpc, getSupportedRpcs, ViewerConfig } from "../common/rpcs";

const appInfo = {
  id: "app",
  title: "Desktop Start",
  envPrefix: "app_",
};

const getAppEnvVar = (varName: string): string | undefined => process.env[`${appInfo.envPrefix}${varName}`];

// create the config object to send to the frontend
const getFrontendConfig = (): ViewerConfig => {
  const parsedArgs = minimist(process.argv.slice(2)); // first two arguments are .exe name and the path to ViewerMain.js. Skip them.
  const iModel = getAppEnvVar("IMODEL");
  const name = getAppEnvVar("PROJECT");
  return {
    snapshotName: parsedArgs._[0] ?? getAppEnvVar("SNAPSHOT"),
    clientId: getAppEnvVar("CLIENT_ID") ?? appInfo.id,
    redirectUri: getAppEnvVar("REDIRECT_URI") ?? `http://localhost:3000/signin-callback`,
    project: (name && iModel) ? { iModel, name } : undefined,
  }
}

/**
 * Initializes Electron backend
 */
const initialize = async () =>  {

  // Setup logging immediately to pick up any logging during IModelHost.startup()
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel(AppLoggerCategory.Backend, LogLevel.Info);

  const hostConfig = new IModelHostConfiguration();
  hostConfig.applicationType = ApplicationType.NativeApp;
  await IModelHost.startup(hostConfig);

  // Initialize Presentation
  Presentation.initialize();

  // Initialize ElectronRpcManager with correct RPC interfaces
  ElectronRpcManager.initializeImpl({}, getSupportedRpcs());

  const opts: ElectronManagerOptions = {
    webResourcesPath: path.join(__dirname, "..", "..", "build"),
  };

  const manager = (process.env.NODE_ENV === "development") ? new WebpackDevServerElectronManager(opts) : new IModelJsElectronManager(opts);

  await manager.initialize({
    width: 1280,
    height: 800,
    show: false,
  });

  if (manager.mainWindow) {
    manager.mainWindow.show();
    if (process.env.NODE_ENV === "development")
      manager.mainWindow.webContents.toggleDevTools();
  }

  // register handlers for viewer's IPC methods.
  ipcMain.handleOnce(appIpc("getConfig"), async () => getFrontendConfig()); // may only be called once
  ipcMain.handle(appIpc("openFile"), async (_event: any, options: any) => dialog.showOpenDialog(options));
}

try {
  initialize(); // eslint-disable-line @typescript-eslint/no-floating-promises
} catch (error) {
  Logger.logError(AppLoggerCategory.Backend, error);
  process.exitCode = 1;
}
