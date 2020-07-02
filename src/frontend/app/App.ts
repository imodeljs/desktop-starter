/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, Config } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelSelect } from "@bentley/imodel-select-react";
import {
  DesktopAuthorizationClientConfiguration, ElectronRpcManager,
} from "@bentley/imodeljs-common";
import {
  DesktopAuthorizationClient, IModelApp, IModelAppOptions,
} from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";
import {
  AppNotificationManager, ColorTheme, ConfigurableUiManager, FrontstageManager, UiFramework,
} from "@bentley/ui-framework";

import { getSupportedRpcs } from "../../common/rpcs";
import { IModelSelectFrontstage } from "../components/frontstages/IModelSelectFrontstage";
import { SnapshotSelectFrontstage } from "../components/frontstages/SnapshotSelectFrontstage";
import { AppState, AppStore } from "./AppState";

export class App {
  private static _appState: AppState;

  public static get oidcClient(): FrontendAuthorizationClient { return IModelApp.authorizationClient as FrontendAuthorizationClient; }

  public static get store(): AppStore { return this._appState.store; }

  public static async startup(): Promise<void> {

    const opts: IModelAppOptions = { applicationVersion: "1.0.0" };
    // Use the AppNotificationManager subclass from ui-framework to get prompts and messages
    opts.notifications = new AppNotificationManager();

    await IModelApp.startup(opts);

    // initialize OIDC
    await App.initializeOidc();

    // initialize Presentation
    await Presentation.initialize({ activeLocale: IModelApp.i18n.languageList()[0] });

    // initialize RPC communication
    ElectronRpcManager.initializeClient({}, getSupportedRpcs());

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

  public static async initializeOidc() {
    const scope = "openid email profile organization imodelhub context-registry-service:read-only product-settings-service urlps-third-party";

    const clientId = Config.App.getString("imjs_electron_test_client_id");
    const redirectUri = Config.App.getString("imjs_electron_test_redirect_uri");
    const oidcConfiguration: DesktopAuthorizationClientConfiguration = { clientId, redirectUri, scope: scope + " offline_access" };
    const desktopClient = new DesktopAuthorizationClient(oidcConfiguration);
    await desktopClient.initialize(new ClientRequestContext());
    IModelApp.authorizationClient = desktopClient;
  }
}
