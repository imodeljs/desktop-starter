/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
import { ConfigurableUiManager, FrontstageManager, FrontstageProvider, SyncUiEventDispatcher, UiFramework } from "@bentley/ui-framework";
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

  /** Handle when an iModel and the view has been selected  */
  public static handleIModelViewSelected = async (iModelConnection: IModelConnection, viewState: ViewState) => {
    // Set the iModelConnection in the Redux store
    UiFramework.setIModelConnection(iModelConnection);
    UiFramework.setDefaultViewState(viewState);

    // Tell the SyncUiEventDispatcher about the iModelConnection
    SyncUiEventDispatcher.initializeConnectionEvents(iModelConnection);

    // We create a FrontStage that contains the view that we want.
    const frontstageProvider: FrontstageProvider = new SampleFrontstage(viewState) as FrontstageProvider;
    FrontstageManager.addFrontstageProvider(frontstageProvider);

    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
  }

}
