/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// make sure webfont brings in the icons and css files.
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import "./AppComponent.css";
import * as React from "react";
import { Provider } from "react-redux";
import { Config, GuidString, Id64 } from "@bentley/bentleyjs-core";
import { IModelHubClient, VersionQuery } from "@bentley/imodelhub-client";
import { IModelVersion, SyncMode } from "@bentley/imodeljs-common";
import {
  BriefcaseConnection, CheckpointConnection, FrontendRequestContext, IModelApp, IModelConnection, MessageBoxIconType, MessageBoxType, NativeApp, ViewState,
} from "@bentley/imodeljs-frontend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { SignIn } from "@bentley/ui-components";
import { Dialog, LoadingSpinner, SpinnerSize } from "@bentley/ui-core";
import {
  ConfigurableUiContent, FrameworkVersion, FrontstageManager, FrontstageProvider, SyncUiEventDispatcher, ThemeManager, ToolbarDragInteractionContext,
  UiFramework,
} from "@bentley/ui-framework";
import { App } from "../app/App";
import { SwitchState } from "../app/AppState";
import { MainFrontstage } from "../components/frontstages/MainFrontstage";
import { AppBackstageComposer } from "./backstage/AppBackstageComposer";
import { BriefcaseIdValue } from "@bentley/imodeljs-backend";

export interface AutoOpenConfig {
  snapshotName: string | null;
  contextId: string | null;
  imodelId: string | null;
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

  private get _snapshotName(): string | null { return this._autoOpenConfig.snapshotName; }
  private set _snapshotName(value: string | null) { this._autoOpenConfig.snapshotName = value; }

  private get _contextId(): GuidString | null { return this._autoOpenConfig.contextId; }
  private set _contextId(value: GuidString | null) { this._autoOpenConfig.contextId = value; }

  private get _imodelId(): GuidString | null { return this._autoOpenConfig.imodelId; }
  private set _imodelId(value: GuidString | null) { this._autoOpenConfig.imodelId = value; }

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

    this._autoOpenConfig = { snapshotName: null, contextId: null, imodelId: null };
    this._isAutoOpen = true;
    this._wantSnapshot = true;

    this.initializeAutoOpen();
    this.addSwitchStateSubscription();
  }

  private initializeAutoOpen() {
    // Then try app configuration (e.g. .env.local)
    if (!this._snapshotName) {
      try {
        this._snapshotName = Config.App.get("IMJS_OFFLINE_IMODEL");
      } catch (e) { }
    }

    // If no snapshot, check if a context/iModel is configured
    if (!this._snapshotName) {
      try {
        this._imodelId = Config.App.get("IMJS_IMODEL_ID");
        this._contextId = Config.App.get("IMJS_CONTEXT_ID", this._imodelId as string);
      } catch (e) { }

      // Check if we cached a snapshot or context/iModel to reopen
      if (!this._contextId || !this._imodelId) {
        this.loadAutoOpenConfig();

        // If nothing was configured, then open the default snapshot
        if (!this._contextId || !this._imodelId) {
          if (!this._snapshotName)
            this._snapshotName = App.config.sampleiModelPath;
        }
      }
    }
    this._wantSnapshot = !this._autoOpenConfig.snapshotName !== true;
  }

  private addSwitchStateSubscription() {
    this._subscription = App.store.subscribe(async () => {
      const switchState = App.store.getState().switchIModelState.switchState;
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
          this._contextId = selectedIModel.contextId;
          this._imodelId = selectedIModel.imodelId;
          this._snapshotName = null;
          this._wantSnapshot = false;
          await this._handleOpen();
        }
      } else if (switchState === SwitchState.OpenSnapshot) {
        const selectedSnapshot: string = App.store.getState().switchIModelState.selectedSnapshot;
        if (selectedSnapshot) {
          this._snapshotName = selectedSnapshot;
          this._contextId = null;
          this._imodelId = null;
          this._wantSnapshot = true;
          await this._handleOpen();
        }
      }
    });
  }

  // Load the recently opened snapshot, context, and iModel names.
  private loadAutoOpenConfig() {
    this._snapshotName = window.localStorage.getItem("IMJS_OFFLINE_IMODEL");
    this._contextId = window.localStorage.getItem("IMJS_CONTEXT_ID");
    this._imodelId = window.localStorage.getItem("IMJS_IMODEL_ID");
  }

  // Save the recently opened snapshot, context, and iModel names.
  private saveAutoOpenConfig() {
    window.localStorage.setItem("IMJS_OFFLINE_IMODEL", this._snapshotName ? this._snapshotName : "");
    window.localStorage.setItem("IMJS_CONTEXT_ID", this._contextId ? this._contextId : "");
    window.localStorage.setItem("IMJS_IMODEL_ID", this._imodelId ? this._imodelId : "");
  }

  // Clear snapshot, context, and iModel names in config.
  private clearAutoOpenConfig() {
    window.localStorage.setItem("IMJS_OFFLINE_IMODEL", "");
    window.localStorage.setItem("IMJS_CONTEXT_ID", "");
    window.localStorage.setItem("IMJS_IMODEL_ID", "");
  }

  public componentDidMount() {
    App.oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
    // Make sure user is signed in before attempting to open an iModel
    if (!this._wantSnapshot && !this.state.user.isAuthorized)
      this.setState((prev) => ({ user: { ...prev.user, isLoading: false } }));
    else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this._handleOpen();
    }
  }

  public componentWillUnmount() {
    this._subscription.unsubscribe();
    App.oidcClient.onUserStateChanged.removeListener(this._onUserStateChanged);
  }

  private _onUserStateChanged() {
    this.setState((prev) => ({ user: { ...prev.user, isAuthorized: App.oidcClient.isAuthorized, isLoading: false } }), async () => {
      if (this.state.user.isAuthorized) {
        if (this._isAutoOpen)
          await this._handleOpen();
      } else
        this.clearAutoOpenConfig();
    });
  };

  private async _onStartSignin() {
    this.setState((prev) => ({ user: { ...prev.user, isLoading: true } }));
    await App.oidcClient.signIn(new FrontendRequestContext());
  };

  private async _onOffline() {
    this._wantSnapshot = true;
    const frontstageDef = FrontstageManager.findFrontstageDef("SnapshotSelector");
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    this.setState({});
  };

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
  private async _onIModelOpened(imodel?: IModelConnection) {
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

        // Cache name of snapshot or imodel/context that was opened for auto-open in next session
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
  };

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

    if (!this._wantSnapshot && !this.state.user.isAuthorized) {
      ui = (<SignIn onSignIn={this._onStartSignin} onOffline={this._onOffline} />);
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
      if (App.oidcClient.isAuthorized || currentIModelConnection.isSnapshot)
        await currentIModelConnection.close();
      UiFramework.setIModelConnection(undefined);
    }
  }

  private async _handleOpen() {
    this._isAutoOpen = false;
    this.setState({ isOpening: true });

    // close previous iModel/snapshot (if open)
    await AppComponent.closeCurrentIModel();

    if (this._wantSnapshot)
      return this._handleOpenSnapshot();

    return this._handleOpenImodel();
  };

  private async _handleOpenSnapshot() {
    if (!this._snapshotName)
      this._snapshotName = App.config.sampleiModelPath;

    let imodel: IModelConnection | undefined;
    try {
      // attempt to open the imodel
      imodel = await BriefcaseConnection.openFile({ fileName: this._snapshotName, readonly: true });
    } catch (e) {
      this.setState({ isOpening: false });
      await IModelApp.notifications.openMessageBox(MessageBoxType.Ok, IModelApp.i18n.translate("App:errorOpenSnapshot", { snapshotName: this._snapshotName, e }), MessageBoxIconType.Critical);
      this.doReselectOnError();
      return;
    }

    await this._onIModelOpened(imodel);
  };

  /** determine the proper version of the iModel to open
   * 1. If named versions exist, get the named version that contains the latest changeset
   * 2. If no named version exists, return the latest changeset
   */
  private async getVersion(): Promise<IModelVersion> {
    const token = await IModelApp.authorizationClient?.getAccessToken();
    if (token) {
      const requestContext = new AuthorizedClientRequestContext(token);
      const hubClient = new IModelHubClient();
      const namedVersions = await hubClient.versions.get(requestContext, this._imodelId!, new VersionQuery().top(1));
      // if there is a named version (version with the latest changeset "should" be at the top), return the version as of its changeset
      // otherwise return the version as of the latest changeset
      return namedVersions.length === 1 && namedVersions[0].changeSetId
        ? IModelVersion.asOfChangeSet(namedVersions[0].changeSetId)
        : IModelVersion.latest();
    }
    return IModelVersion.latest();
  };

  // get the local filename for the "pullOnly" briefcase for the current iModelId
  private async getPullOnlyBriefcase(): Promise<string> {
    const iModelId = this._imodelId!;
    const briefcases = await NativeApp.getCachedBriefcases(iModelId);
    for (const briefcase of briefcases) {
      if (briefcase.briefcaseId === BriefcaseIdValue.Standalone) // this is the briefcaseId for "pullOnly"
        return briefcase.fileName; // we already have it.
    }
    // TODO:  add progress indicator with cancel button
    const download = await NativeApp.requestDownloadBriefcase(this._contextId!, iModelId, { syncMode: SyncMode.PullOnly })
    await download.downloadPromise;
    return download.fileName;
  }

  private async _handleOpenImodel() {
    if (!this._contextId || !this._imodelId) {
      this.setState({ isOpening: false });
      return;
    }
    this._snapshotName = null;

    try {
      const briefcase = await BriefcaseConnection.openFile({ fileName: await this.getPullOnlyBriefcase(), readonly: true });

      // TODO: Check if briefcase changesetId and see if we need to pull changes. If so, call briefcase.pullAndMergeChange();

      await this._onIModelOpened(briefcase);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error opening iModel: ${error.message}`);
      throw error;
    }
  };
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
