/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelSelect } from "@bentley/imodel-select-react";
import { AsyncMethodsOf, IModelApp, IpcApp, PromiseReturnType } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";
import { AppNotificationManager, ColorTheme, ConfigurableUiManager, FrontstageManager, UiFramework } from "@bentley/ui-framework";
import { desktopStarterChannel, DesktopStarterInterface, getRpcInterfaces, ViewerConfig } from "../../common/ViewerProps";
import { IModelSelectFrontstage } from "../components/frontstages/IModelSelectFrontstage";
import { SnapshotSelectFrontstage } from "../components/frontstages/SnapshotSelectFrontstage";
import { AppState, AppStore } from "./AppState";

export class App {
  private static _appState: AppState;
  public static config: ViewerConfig;

  public static get oidcClient(): FrontendAuthorizationClient { return IModelApp.authorizationClient as FrontendAuthorizationClient; }

  public static get store(): AppStore { return this._appState.store; }
  public static async callMyBackend<T extends AsyncMethodsOf<DesktopStarterInterface>>(methodName: T, ...args: Parameters<DesktopStarterInterface[T]>) {
    return IpcApp.callIpcChannel(desktopStarterChannel, methodName, ...args) as PromiseReturnType<DesktopStarterInterface[T]>;
  }

  public static async startup(): Promise<void> {
    await ElectronApp.startup({
      iModelApp: {
        applicationVersion: "1.0.0",
        notifications: new AppNotificationManager(), // Use the AppNotificationManager subclass from ui-framework to get prompts and messages
        rpcInterfaces: getRpcInterfaces(),
      },
    });

    this.config = await this.callMyBackend("getConfig");

    // initialize Presentation
    await Presentation.initialize({ activeLocale: IModelApp.i18n.languageList()[0] });

    // initialize localization for the app
    await IModelApp.i18n.registerNamespace("App").readFinished;

    // create the application state store for Redux
    this._appState = new AppState();

    // initialize UiFramework
    await UiFramework.initialize(this.store, IModelApp.i18n);

    // initialize IModelSelect
    await IModelSelect.initialize(IModelApp.i18n);

    // initialize to use "dark" theme
    UiFramework.setColorTheme(ColorTheme.Dark);

    // initialize the ConfigurableUiManager
    ConfigurableUiManager.initialize();

    // Create a FrontStage where we can select a project/iModel.
    FrontstageManager.addFrontstageProvider(new IModelSelectFrontstage());

    // Create a FrontStage where we can select a snapshot.
    FrontstageManager.addFrontstageProvider(new SnapshotSelectFrontstage());
  }
}
