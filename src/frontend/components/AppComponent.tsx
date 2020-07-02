/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// make sure webfont brings in the icons and css files.
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import "./AppComponent.css";

import * as path from "path";
import * as React from "react";
import { Provider } from "react-redux";

import { Config, Id64, OpenMode } from "@bentley/bentleyjs-core";
import { ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { HubIModel, IModelQuery } from "@bentley/imodelhub-client";
import {
  AuthorizedFrontendRequestContext, FrontendRequestContext, IModelApp, IModelConnection,
  MessageBoxIconType, MessageBoxType, NotifyMessageDetails, OutputMessagePriority,
  OutputMessageType, RemoteBriefcaseConnection, SnapshotConnection, ViewState,
} from "@bentley/imodeljs-frontend";
import { SignIn } from "@bentley/ui-components";
import { Dialog, LoadingSpinner, SpinnerSize } from "@bentley/ui-core";
import {
  ConfigurableUiContent, FrameworkVersion, FrontstageManager, FrontstageProvider, MessageManager,
  SyncUiEventDispatcher, ThemeManager, ToolbarDragInteractionContext, UiFramework,
} from "@bentley/ui-framework";

import { App } from "../app/App";
import { SwitchState } from "../app/AppState";
import { MainFrontstage } from "../components/frontstages/MainFrontstage";
import { AppBackstageComposer } from "./backstage/AppBackstageComposer";

export interface AutoOpenConfig {
  snapshotName: string | null;
  projectName: string | null;
  imodelName: string | null;
}

/** React state of the App component */
export interface AppState {
  user: {
    isAuthorized: boolean;
    isLoading?: boolean;
  };
  isOpening: boolean;         // is opening a snapshot/iModel
}

/** A component that renders the whole application UI */
export default class AppComponent extends React.Component<{}, AppState> {
  private _subscription: any;
  private _autoOpenConfig: AutoOpenConfig;
  private _isAutoOpen: boolean;         // auto-opening iModel?
  private _wantSnapshot: boolean;

  private get snapshotName(): string | null { return this._autoOpenConfig.snapshotName; }
  private set snapshotName(value: string | null) { this._autoOpenConfig.snapshotName = value; }

  private get projectName(): string | null { return this._autoOpenConfig.projectName; }
  private set projectName(value: string | null) { this._autoOpenConfig.projectName = value; }

  private get imodelName(): string | null { return this._autoOpenConfig.imodelName; }
  private set imodelName(value: string | null) { this._autoOpenConfig.imodelName = value; }

  /** Creates an App instance */
  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      user: {
        isAuthorized: App.oidcClient.isAuthorized,
        isLoading: false,
      },
      isOpening: false,
    };

    this._autoOpenConfig = { snapshotName: null, projectName: null, imodelName: null };
    this._isAutoOpen = true;
    this._wantSnapshot = true;

    this.initializeAutoOpen();
    this.addSwitchStateSubscription();
  }

  private initializeAutoOpen() {
    // If a snapshot is configured in .env.local, then use for auto-opening at startup
    try {
      this.snapshotName = Config.App.get("imjs_offline_imodel");
    } catch (e) { }

    // If no snapshot, check if a project/iModel is configured
    if (!this.snapshotName) {
      try {
        this.imodelName = Config.App.get("imjs_test_imodel");
        this.projectName = Config.App.get("imjs_test_project", this.imodelName as string);
      } catch (e) { }

      // Check if we cached a snapshot or project/iModel to reopen
      if (!this.projectName || !this.imodelName) {
        this.loadAutoOpenConfig();

        // If nothing was configured, then open the default snapshot
        if (!this.projectName || !this.imodelName) {
          if (!this.snapshotName)
            this.snapshotName = this.getDefaultSnapshot();
        }
      }
    }
    this._wantSnapshot = !this._autoOpenConfig.snapshotName !== true;
  }

  private addSwitchStateSubscription() {
    this._subscription = App.store.subscribe(async () => {
      const switchState = App.store.getState().switchIModelState!.switchState;
      if (switchState === SwitchState.SelectIModel) {
        this._wantSnapshot = false;
        // Trigger sign-in if not authorized yet
        if (!this.state.user.isAuthorized)
          this.setState((prev) => ({ user: { ...prev.user, isLoading: false } }));
        const frontstageDef = FrontstageManager.findFrontstageDef("IModelSelector");
        await FrontstageManager.setActiveFrontstageDef(frontstageDef);
      } else if (switchState === SwitchState.SelectSnapshot) {
        this._wantSnapshot = true;
        const frontstageDef = FrontstageManager.findFrontstageDef("SnapshotSelector");
        await FrontstageManager.setActiveFrontstageDef(frontstageDef);
      } else if (switchState === SwitchState.OpenIModel) {
        const selectedIModel = App.store.getState().switchIModelState.selectedIModel;
        if (selectedIModel) {
          this.projectName = selectedIModel.projectName;
          this.imodelName = selectedIModel.imodelName;
          this.snapshotName = null;
          this._wantSnapshot = false;
          await this._handleOpen();
        }
      } else if (switchState === SwitchState.OpenSnapshot) {
        const selectedSnapshot: string = App.store.getState().switchIModelState.selectedSnapshot;
        if (selectedSnapshot) {
          this.snapshotName = selectedSnapshot;
          this._wantSnapshot = true;
          await this._handleOpen();
        }
      }
    });
  }

  // Load the recently opened snapshot, project, and iModel names.
  private loadAutoOpenConfig() {
    this.snapshotName = window.localStorage.getItem("imjs_offline_imodel");
    this.projectName = window.localStorage.getItem("imjs_test_project");
    this.imodelName = window.localStorage.getItem("imjs_test_imodel");
  }

  // Save the recently opened snapshot, project, and iModel names.
  private saveAutoOpenConfig() {
    window.localStorage.setItem("imjs_offline_imodel", this.snapshotName ? this.snapshotName : "");
    window.localStorage.setItem("imjs_test_project", this.projectName ? this.projectName : "");
    window.localStorage.setItem("imjs_test_imodel", this.imodelName ? this.imodelName : "");
  }

  private getRemote(): any {
    return require("electron").remote;
  }

  private getDefaultSnapshot(): string {
    let defaultPath = "assets";
    if (this.getRemote().app.isPackaged)
      defaultPath = path.join("resources", "app", "assets");
    return path.join(defaultPath, "Baytown.bim");
  }

  public componentDidMount() {
    App.oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
    // Make sure user is signed in before attempting to open an iModel
    if (!this._wantSnapshot && !this.state.user.isAuthorized)
      this.setState((prev) => ({ user: { ...prev.user, isLoading: false } }));
    else {
      // tslint:disable-next-line: no-floating-promises
      this._handleOpen();
    }
  }

  public componentWillUnmount() {
    this._subscription.unsubscribe();
    App.oidcClient.onUserStateChanged.removeListener(this._onUserStateChanged);
  }

  private _onUserStateChanged = () => {
    this.setState((prev) => ({ user: { ...prev.user, isAuthorized: App.oidcClient.isAuthorized, isLoading: false } }), async () => {
      if (this._isAutoOpen && this.state.user.isAuthorized) {
        await this._handleOpen();
      }
    });
  }

  private _onStartSignin = async () => {
    this.setState((prev) => ({ user: { ...prev.user, isLoading: true } }));
    await App.oidcClient.signIn(new FrontendRequestContext());
  }

  /** Pick the first available spatial, orthographic or drawing view definition in the iModel */
  private async getFirstViewDefinition(imodel: IModelConnection): Promise<ViewState | null> {
    const defaultViewId = await imodel.views.queryDefaultViewId();
    if (defaultViewId && Id64.isValidId64(defaultViewId))
      return imodel.views.load(defaultViewId);

    const viewSpecs = await imodel.views.queryProps({});
    const acceptedViewClasses = [
      "BisCore:SpatialViewDefinition",
      "BisCore:DrawingViewDefinition",
      "BisCore:OrthographicViewDefinition",
    ];
    const acceptedViewSpecs = viewSpecs.filter((spec) => (-1 !== acceptedViewClasses.indexOf(spec.classFullName)));
    if (!acceptedViewSpecs.length) {
      await IModelApp.notifications.openMessageBox(MessageBoxType.Ok, IModelApp.i18n.translate("App:noViewDefinition", undefined), MessageBoxIconType.Information);
      return null;
    }

    return imodel.views.load(acceptedViewSpecs[0].id!);
  }

  /** Handle iModel open event */
  private _onIModelOpened = async (imodel: IModelConnection | undefined) => {
    this.setState({ isOpening: false });
    if (!imodel) {
      UiFramework.setIModelConnection(undefined);
      return;
    }
    try {
      // attempt to get ViewState for the first available view definition
      const viewState = await this.getFirstViewDefinition(imodel);
      if (viewState) {
        // Set the iModelConnection in the Redux store
        UiFramework.setIModelConnection(imodel);
        UiFramework.setDefaultViewState(viewState);

        // We create a FrontStage that contains the view that we want.
        const frontstageProvider: FrontstageProvider = new MainFrontstage() as FrontstageProvider;
        FrontstageManager.addFrontstageProvider(frontstageProvider);

        // Tell the SyncUiEventDispatcher about the iModelConnection
        SyncUiEventDispatcher.initializeConnectionEvents(imodel);

        await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

        // Cache name of snapshot or imodel/project that was opened for auto-open in next session
        this.saveAutoOpenConfig();
      } else {
        // If we failed to find a viewState, then we will just close the imodel and allow the user to select a different shapshot/iModel
        await AppComponent.closeCurrentIModel();
        this.doReselectOnError();
      }
    } catch (e) {
      // if failed, close the imodel and reset the state
      await AppComponent.closeCurrentIModel();
      alert(e.message);
      this.doReselectOnError();
    }
  }

  private doReselectOnError() {
    if (this._wantSnapshot)
      App.store.dispatch({ type: "App:SELECT_SNAPSHOT" });
    else
      App.store.dispatch({ type: "App:SELECT_IMODEL" });
  }

  private _renderSpinner(msg: string) {
    return (
      <Dialog opened={true} modal={true} hideHeader={true} width={300}>
        <span style={{ margin: "10px" }}>
          <LoadingSpinner size={SpinnerSize.Large} message={msg} />
        </span>
      </Dialog>
    );
  }

  /** The component's render method */
  public render() {
    let ui: React.ReactNode;

    if (!this.state.user.isAuthorized && !this._wantSnapshot) {
      ui = (<SignIn onSignIn={this._onStartSignin}/>);
    } else {
      // if we do have an imodel and view definition id - render imodel components
      ui = <IModelComponents />;
    }

    // render the app
    return (
      <Provider store={App.store} >
        <div className="AppComponent">
          {ui}
          {this.state.user.isLoading && this._renderSpinner(IModelApp.i18n.translate("App:signing-in"))}
          {this.state.isOpening && this._renderSpinner(IModelApp.i18n.translate("App:opening"))}
        </div>
      </Provider>
    );
  }

  public static async closeCurrentIModel() {
    const currentIModelConnection = UiFramework.getIModelConnection();
    if (currentIModelConnection) {
      SyncUiEventDispatcher.clearConnectionEvents(currentIModelConnection);

      await currentIModelConnection.close();
      UiFramework.setIModelConnection(undefined);
    }
  }

  private _handleOpen = async () => {
    this._isAutoOpen = false;
    this.setState({ isOpening: true });

    // close previous iModel/snapshot (if open)
    await AppComponent.closeCurrentIModel();

    if (this._wantSnapshot)
      return this._handleOpenSnapshot();

    return this._handleOpenImodel();
  }

  private _handleOpenSnapshot = async () => {

    if (!this.snapshotName)
      this.snapshotName = this.getDefaultSnapshot();

    let imodel: IModelConnection | undefined;
    try {
      // attempt to open the imodel
      imodel = await SnapshotConnection.openFile(this.snapshotName);
    } catch (e) {
      this.setState({ isOpening: false });
      await IModelApp.notifications.openMessageBox(MessageBoxType.Ok, IModelApp.i18n.translate("App:errorOpenSnapshot", {snapshotName: this.snapshotName, e}), MessageBoxIconType.Critical);
      this.doReselectOnError();
      return;
    }

    await this._onIModelOpened(imodel);
  }

  private _handleOpenImodel = async () => {
    if (!this.projectName || !this.imodelName) {
      this.setState({ isOpening: false });
      return;
    }
    this.snapshotName = null;

    const requestContext: AuthorizedFrontendRequestContext = await AuthorizedFrontendRequestContext.create();
    const connectClient = new ContextRegistryClient();
    let project: Project | undefined;
    try {
      project = await connectClient.getProject(requestContext, { $filter: `Name+eq+'${this.projectName}'` });
    } catch (e) {
      project = undefined;
    }
    if (!project) {
      this.setState({ isOpening: false });
      MessageManager.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, IModelApp.i18n.translate("App:noProject", { projectName: this.projectName }), undefined, OutputMessageType.Alert));
      this.doReselectOnError();
      return;
    }

    const imodelQuery = new IModelQuery();
    imodelQuery.byName(this.imodelName);
    let imodels: HubIModel[] | undefined;
    try {
      imodels = await IModelApp.iModelClient.iModels.get(requestContext, project.wsgId, imodelQuery);
    } catch (e) {
      imodels = undefined;
    }
    if (!imodels || !imodels.length) {
      this.setState({ isOpening: false });
      MessageManager.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, IModelApp.i18n.translate("App:noIModel", { imodelName: this.imodelName, projectName: this.projectName }), undefined, OutputMessageType.Alert));
      this.doReselectOnError();
      return;
    }

    let imodel: IModelConnection | undefined;
    imodel = await RemoteBriefcaseConnection.open(project.wsgId, imodels[0].wsgId, OpenMode.Readonly);

    await this._onIModelOpened(imodel);
  }
}

/** Renders a viewport and a property grid */
class IModelComponents extends React.PureComponent {
  public render() {
    return (
      <Provider store={App.store} >
        <ThemeManager>
          <ToolbarDragInteractionContext.Provider value={false}>
            <FrameworkVersion version={"2"}>
              <ConfigurableUiContent appBackstage={<AppBackstageComposer />} />
            </FrameworkVersion>
          </ToolbarDragInteractionContext.Provider>
        </ThemeManager>
      </Provider >
    );
  }
}
