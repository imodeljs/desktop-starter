/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, Config } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { DesktopAuthorizationClientConfiguration, ElectronRpcManager } from "@bentley/imodeljs-common";
import { DesktopAuthorizationClient, IModelApp, IModelAppOptions } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";
import { IModelSelect } from "@bentley/imodel-select-react";
import { AppNotificationManager, UiFramework } from "@bentley/ui-framework";
import { AppState, AppStore } from "./AppState";

import { getSupportedRpcs } from "../../common/rpcs";

export class SampleApp {
  private static _appState: AppState;

  public static get oidcClient(): FrontendAuthorizationClient { return IModelApp.authorizationClient as FrontendAuthorizationClient; }

  public static get store(): AppStore { return this._appState.store; }

  public static async startup(): Promise<void> {

    // Use the AppNotificationManager subclass from ui-framework to get prompts and messages
    const opts: IModelAppOptions = {applicationVersion: "1.0.0"};
    opts.notifications = new AppNotificationManager();

    await IModelApp.startup(opts);

    // initialize OIDC
    await SampleApp.initializeOidc();

    // initialize Presentation
    await Presentation.initialize({activeLocale: IModelApp.i18n.languageList()[0]});

    // initialize RPC communication
    ElectronRpcManager.initializeClient({}, getSupportedRpcs());

    // initialize localization for the app
    await IModelApp.i18n.registerNamespace("SampleApp").readFinished;

    // create the application state store for Redux
    this._appState = new AppState();

    // initialize UiFramework
    await UiFramework.initialize(this.store, IModelApp.i18n);

    // initialize IModelSelect
    await IModelSelect.initialize(IModelApp.i18n);
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
