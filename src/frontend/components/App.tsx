/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as path from "path";
import { Provider } from "react-redux";
import { Config, OpenMode } from "@bentley/bentleyjs-core";
import { ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { IModelQuery } from "@bentley/imodelhub-client";
import { AuthorizedFrontendRequestContext, FrontendRequestContext, IModelApp, IModelConnection, RemoteBriefcaseConnection, SnapshotConnection, ViewState } from "@bentley/imodeljs-frontend";
import { SignIn } from "@bentley/ui-components";
import { ConfigurableUiContent, FrontstageManager, SyncUiEventDispatcher, UiFramework } from "@bentley/ui-framework";
import { UiItemsManager } from "@bentley/ui-abstract";
import { AppUi } from "../app-ui/AppUi";
import { AppBackstageItemProvider } from "../app-ui/backstage/AppBackstageItemProvider";
import { AppBackstageComposer } from "../app-ui/backstage/AppBackstageComposer";
import { SampleApp } from "../app/SampleApp";
import { SwitchState } from "../app/AppState";
// make sure webfont brings in the icons and css files.
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import "./App.css";

/** React state of the App component */
export interface AppState {
  user: {
    isAuthorized: boolean;
    isLoading?: boolean;
  };
  isOpening: boolean;         // is opening a snapshot/iModel
}

/** A component that renders the whole application UI */
export default class App extends React.Component<{}, AppState> {
  private _subscription: any;
  private _snapshotName: string | null;
  private _projectName: string | null;
  private _imodelName: string | null;
  private _wantSnapshot: boolean;      // selecting snapshot?


  /** Creates an App instance */
  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      user: {
        isAuthorized: SampleApp.oidcClient.isAuthorized,
        isLoading: false,
      },
      isOpening: false,
    };

    this._snapshotName = null;
    this._projectName = null;
    this._imodelName = null;
    this._wantSnapshot = false;

    this.initialize();
    this.addSwitchStateSubscription();
  }

  private addSwitchStateSubscription() {
    this._subscription = SampleApp.store.subscribe(async () => {
      const switchState = SampleApp.store.getState().switchIModelState!.switchState;
      if (switchState === SwitchState.SelectIModel) {
        this._wantSnapshot = false;
        const frontstageDef = FrontstageManager.findFrontstageDef("IModelSelector");
        await FrontstageManager.setActiveFrontstageDef(frontstageDef);
      } else if (switchState === SwitchState.SelectSnapshot) {
        this._wantSnapshot = true;
        await this._handleSelectSnapshot();
      } else if (switchState === SwitchState.OpenIt) {
        await this._handleOpen();
      }
    });
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

  private initialize() {
    // If a snapshot is configured in .env.local, then use for auto-opening at startup
    try {
      this._snapshotName = Config.App.get("imjs_offline_imodel");
    } catch (e) {}

    if (this._snapshotName && this._snapshotName.length) {
      this._wantSnapshot = true;
    } else {
      try {
        this._imodelName = Config.App.get("imjs_test_imodel");
        this._projectName = Config.App.get("imjs_test_project", this._imodelName as string);
      } catch (e) {}

      if (!this._projectName || !this._projectName.length || !this._imodelName || !this._imodelName.length) {
        // If nothing was configured, then open the default snapshot
        this._snapshotName = this.getDefaultSnapshot();
        this._wantSnapshot = true;
      }
    }
  }

  public componentDidMount() {
    SampleApp.oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
    // tslint:disable-next-line: no-floating-promises
    this._handleOpen();
  }

  public componentWillUnmount() {
    this._subscription.unsubscribe();
    SampleApp.oidcClient.onUserStateChanged.removeListener(this._onUserStateChanged);
  }

  private _onUserStateChanged = () => {
    this.setState((prev) => ({ user: { ...prev.user, isAuthorized: SampleApp.oidcClient.isAuthorized, isLoading: false } }));
  }

  private _onRegister = () => {
    window.open("https://git.io/fx8YP", "_blank");
  }

  private _onStartSignin = async () => {
    this.setState((prev) => ({ user: { ...prev.user, isLoading: true } }));
    await SampleApp.oidcClient.signIn(new FrontendRequestContext());
  }

  /** Pick the first available spatial, orthographic or drawing view definition in the iModel */
  private async getFirstViewDefinition(imodel: IModelConnection): Promise<ViewState> {
    const viewSpecs = await imodel.views.queryProps({});
    const acceptedViewClasses = [
      "BisCore:SpatialViewDefinition",
      "BisCore:DrawingViewDefinition",
      "BisCore:OrthographicViewDefinition",
    ];
    const acceptedViewSpecs = viewSpecs.filter((spec) => (-1 !== acceptedViewClasses.indexOf(spec.classFullName)));
    if (1 > acceptedViewSpecs.length)
      throw new Error(IModelApp.i18n.translate("SampleApp:noViewDefinition"));

    return imodel.views.load(acceptedViewSpecs[0].id!);
  }

  /** Handle iModel open event */
  private _onIModelOpened = async (imodel: IModelConnection | undefined) => {
    if (!imodel) {
      this.setState({ isOpening: false });
      UiFramework.setIModelConnection(undefined);
      return;
    }
    try {
      // attempt to get ViewState for the first available view definition
      const viewState = await this.getFirstViewDefinition(imodel);
      if (viewState) {
        this.setState({ isOpening: false },
          () => { AppUi.handleIModelViewsSelected(imodel, viewState); },
        );
      }
    } catch (e) {
      // if failed, close the imodel and reset the state
      await imodel.close();
      this.setState({ isOpening: false });
      alert(e.message);
    }
  }

  /** The component's render method */
  public render() {
    let ui: React.ReactNode;

    if (this.state.user.isLoading) {
      // if OIDC is initializing or user is currently being loaded, just show that
      ui = <span style={{ marginLeft: "8px", marginTop: "8px" }}>{IModelApp.i18n.translate("SampleApp:signing-in")}...</span>;
    } else if (!this.state.user.isAuthorized && !this._wantSnapshot) {
      ui = (<SignIn onSignIn={this._onStartSignin} onRegister={this._onRegister} />);
    } else if (this.state.isOpening) {
      // if iModel is currently being opened, just show that
      ui = <span style={{ marginLeft: "8px", marginTop: "8px" }}>{IModelApp.i18n.translate("SampleApp:opening")}...</span>;
    } else {
      // if we do have an imodel and view definition id - render imodel components
      ui = <IModelComponents/>;
    }

    // render the app
    return (
      <Provider store={SampleApp.store} >
        <div className="App">
          {ui}
        </div>
      </Provider>
    );
  }

  private _handleSelectSnapshot = async () => {
    const options = {
      properties: ["openFile"],
      filters: [{ name: "iModels", extensions: ["ibim", "bim"] }],
    };

    let filenames;

    try {
      filenames = this.getRemote().dialog.showOpenDialogSync(options);
    } catch (e) {}

    if (filenames && filenames.length) {
      this._projectName = "";
      this._imodelName = "";
      this._snapshotName = filenames[0];
      const currentIModelConnection = UiFramework.getIModelConnection();
      if (currentIModelConnection) {
        SyncUiEventDispatcher.clearConnectionEvents(currentIModelConnection);
        await currentIModelConnection.close();
        UiFramework.setIModelConnection(undefined);
      }
      await this._handleOpenSnapshot();
    }
  }

  private _handleOpen = async () => {

    // Make sure user is signed in before attempting to open an iModel
    if (!this._wantSnapshot && !this.state.user.isAuthorized)
      return;

    this.setState({ isOpening: true});

    if (this._wantSnapshot)
      return this._handleOpenSnapshot();

    return this._handleOpenImodel();
  }

  private _handleOpenSnapshot = async () => {

    if (!this._snapshotName || this._snapshotName.length === 0)
      this._snapshotName = this.getDefaultSnapshot();

    let imodel: IModelConnection | undefined;
    try {
      // attempt to open the imodel
      imodel = await SnapshotConnection.openFile(this._snapshotName);
    } catch (e) {
      const errMsg = IModelApp.i18n.translate("SampleApp:errorOpenSnapshot", {snapshotName: this._snapshotName, e});
      const con = this.getRemote().getGlobal("console");
      con.log(errMsg);
      window.close();
      process.exit(0);
    }

    if (imodel)
      await this._onIModelOpened(imodel);
    else
      this.setState({ isOpening: false });
  }

  private _handleOpenImodel = async () => {
    if (!this._projectName || !this._projectName.length || !this._imodelName || !this._imodelName.length) {
      this.setState({ isOpening: false });
      return;
    }
    const requestContext: AuthorizedFrontendRequestContext = await AuthorizedFrontendRequestContext.create();
    const connectClient = new ContextRegistryClient();
    let project: Project;
    try {
      project = await connectClient.getProject(requestContext, { $filter: `Name+eq+'${this._projectName}'` });
    } catch (e) {
      this.setState({ isOpening: false });
      throw new Error(IModelApp.i18n.translate("SampleApp:noProject", {projectName: this._projectName}));
    }

    const imodelQuery = new IModelQuery();
    imodelQuery.byName(this._imodelName);
    const imodels = await IModelApp.iModelClient.iModels.get(requestContext, project.wsgId, imodelQuery);
    if (imodels.length === 0) {
      this.setState({ isOpening: false });
      throw new Error(IModelApp.i18n.translate("SampleApp:noIModel", {imodelName: this._imodelName, projectName: this._projectName}));
    }
    this.setState({ isOpening: true });

    let imodel: IModelConnection | undefined;
    imodel = await RemoteBriefcaseConnection.open(project.wsgId, imodels[0].wsgId, OpenMode.Readonly);

    await this._onIModelOpened(imodel);
  }
}

/** Renders a viewport and a property grid */
class IModelComponents extends React.PureComponent {

  private _provider = new AppBackstageItemProvider();

  public componentDidMount() {
    UiItemsManager.register(this._provider);
  }

  public componentWillUnmount() {
    UiItemsManager.unregister(this._provider.id);
  }

  public render() {
    return (
      <ConfigurableUiContent appBackstage={<AppBackstageComposer />} />
    );
  }
}
