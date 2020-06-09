/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
import { Backstage, ConfigurableUiManager, FrontstageManager, FrontstageProvider, SyncUiEventDispatcher, UiFramework } from "@bentley/ui-framework";
import { SampleFrontstage } from "./frontstages/SampleFrontstage";
import { IModelSelectFrontstage } from "./frontstages/IModelSelectFrontstage";

/**
 * Example Ui Configuration for an iModel.js App
 */
export class AppUi {

  // Initialize the ConfigurableUiManager
  public static initialize() {
    ConfigurableUiManager.initialize();

    // Create a FrontStage where we can select a project/iModel.
    FrontstageManager.addFrontstageProvider(new IModelSelectFrontstage());
  }

  // Command that toggles the backstage
  public static get backstageToggleCommand() {
    return Backstage.backstageToggleCommand;
  }

  /** Handle when an iModel and the views have been selected  */
  public static handleIModelViewsSelected(iModelConnection: IModelConnection, viewStates: ViewState[]): void {
    // Set the iModelConnection in the Redux store
    UiFramework.setIModelConnection(iModelConnection);
    UiFramework.setDefaultViewState(viewStates[0]);

    // Tell the SyncUiEventDispatcher about the iModelConnection
    SyncUiEventDispatcher.initializeConnectionEvents(iModelConnection);

    // We create a FrontStage that contains the views that we want.
    const frontstageProvider: FrontstageProvider = new SampleFrontstage(viewStates) as FrontstageProvider;
    FrontstageManager.addFrontstageProvider(frontstageProvider);

    // tslint:disable-next-line:no-floating-promises
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => {
      // Frontstage is ready
    });
  }

}
