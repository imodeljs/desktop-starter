/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as minimist from "minimist";
import * as path from "path";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { ElectronHost } from "@bentley/electron-manager/lib/ElectronBackend";
import { Presentation } from "@bentley/presentation-backend";
import { AppLoggerCategory } from "../common/LoggerCategory";
import { dtsChannel, DtsInterface, getRpcInterfaces, ViewerConfig } from "../common/ViewerProps";
import { IpcHandler } from "@bentley/imodeljs-backend";

const appInfo = {
  id: "app",
  title: "Desktop Start",
  envPrefix: "app_",
};

const getAppEnvVar = (varName: string): string | undefined => process.env[`${appInfo.envPrefix}${varName}`];

class DtsHandler extends IpcHandler implements DtsInterface {
  public get channelName() { return dtsChannel; }
  public async getConfig(): Promise<ViewerConfig> {
    // first two arguments are .exe name and the path to ViewerMain.js. Skip them.
    const parsedArgs = process.env.NODE_ENV === "development"
      ? minimist(process.argv.slice(2 + process.argv.findIndex((a: string) => a.includes("main.js"))))
      : minimist(process.argv.slice(1));

    const samplePath = ElectronHost.app.isPackaged
      ? path.join(ElectronHost.app.getAppPath(), "build", "assets").replace("app.asar", "app.asar.unpacked")
      : path.join("assets", "Baytown.bim");

    const iModel = getAppEnvVar("IMODEL");
    const name = getAppEnvVar("PROJECT");

    return {
      sampleiModelPath: samplePath,
      snapshotName: parsedArgs._[0] ?? getAppEnvVar("SNAPSHOT"),
      clientId: getAppEnvVar("CLIENT_ID") ?? appInfo.id,
      redirectUri: getAppEnvVar("REDIRECT_URI") ?? `http://localhost:3000/signin-callback`,
      project: (name && iModel) ? { iModel, name } : undefined,
    };
  }
}

/**
 * Initializes Electron backend
 */
const initialize = async () => {

  // Setup logging immediately to pick up any logging during IModelHost.startup()
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel(AppLoggerCategory.Backend, LogLevel.Info);

  const opts = {
    electronHost: {
      webResourcesPath: path.join(__dirname, "..", "..", "build"),
      rpcInterfaces: getRpcInterfaces(),
      ipcHandlers: [DtsHandler],
      developmentServer: process.env.NODE_ENV === "development",
    },
  };

  await ElectronHost.startup(opts);

  // Initialize Presentation
  Presentation.initialize();

  await ElectronHost.openMainWindow({ width: 1280, height: 800, show: true });

  if (process.env.NODE_ENV === "development")
    ElectronHost.mainWindow?.webContents.toggleDevTools();
};

try {
  initialize(); // eslint-disable-line @typescript-eslint/no-floating-promises
} catch (error) {
  Logger.logError(AppLoggerCategory.Backend, error);
  process.exitCode = 1;
}
