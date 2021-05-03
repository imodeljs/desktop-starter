/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as minimist from "minimist";
import * as path from "path";
import { assert, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { ElectronHost } from "@bentley/electron-manager/lib/ElectronBackend";
import { Presentation } from "@bentley/presentation-backend";
import { AppLoggerCategory } from "../common/LoggerCategory";
import { desktopStarterChannel, DesktopStarterInterface, getRpcInterfaces, ViewerConfig } from "../common/ViewerProps";
import { IpcHandler } from "@bentley/imodeljs-backend";

const appInfo = {
  id: "app",
  title: "Desktop Starter",
  envPrefix: "app_",
};

const getAppEnvVar = (varName: string): string | undefined => process.env[`${appInfo.envPrefix}${varName}`];

class DesktopStarterHandler extends IpcHandler implements DesktopStarterInterface {
  public get channelName() { return desktopStarterChannel; }
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

  const clientId = process.env.IMJS_ELECTRON_CLIENT_ID; // **** Replace with your Client ID  ****
  assert(clientId !== undefined, `No Client ID provided.`); // Please create a new "Desktop / Mobile" client at developer.bentley.com and assign the Client ID to the variable above

  const opts = {
    electronHost: {
      webResourcesPath: path.join(__dirname, "..", "..", "build"),
      rpcInterfaces: getRpcInterfaces(),
      ipcHandlers: [DesktopStarterHandler],
      developmentServer: process.env.NODE_ENV === "development",
      authConfig: {
        clientId,
        scope: "openid email profile organization imodelhub context-registry-service:read-only product-settings-service urlps-third-party offline_access",
      },
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
