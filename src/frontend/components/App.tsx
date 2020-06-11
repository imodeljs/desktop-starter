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
import { ArgReaderRpcInterface } from "../../common/ArgReaderRpcInterface";
// make sure webfont brings in the icons and css files.
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import "./App.css";

/** React state of the App component */
export interface AppState {
  user: {
    isAuthorized: boolean;
    isLoading?: boolean;
  };
  imodel?: IModelConnection;
  viewState?: ViewState;
  isAutoOpening: boolean;     // is auto-opening or switching
  wantSnapshot: boolean;      // selecting snapshot?
  isOpening: boolean;         // is opening another snapshot/iModel
}

/** A component that renders the whole application UI */
export default class App extends React.Component<{}, AppState> {
  private _subscription: any;

  /** Creates an App instance */
  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = this.initialize();

    this.addSwitchStateSubscription();
  }

  private addSwitchStateSubscription() {
    this._subscription = SampleApp.store.subscribe(async () => {
      const switchState = SampleApp.store.getState().switchIModelState!.switchState;
      if (switchState === SwitchState.SelectIModel) {
        this.setState({ wantSnapshot: false });
        const frontstageDef = FrontstageManager.findFrontstageDef("IModelSelector");
        await FrontstageManager.setActiveFrontstageDef(frontstageDef);
      } else if (switchState === SwitchState.SelectSnapshot) {
        this.setState({ wantSnapshot: true });
        await this._handleSelectSnapshot();
      } else if (switchState === SwitchState.OpenIt) {
        await this._handleOpen();
      } else if (switchState === SwitchState.ClearState) {
        this.setState({ imodel: undefined, viewState: undefined, isOpening: false });
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

  private initialize(): any {
    const initState = {
      user: {
        isAuthorized: SampleApp.oidcClient.isAuthorized,
        isLoading: false,
      },
      imodel: undefined,
      viewState: undefined,
      isAutoOpening: true,
      wantSnapshot: false,
      isOpening: false,
    };

    // If a snapshot is configured in .env.local, then cache in local storage
    // to use for auto-opening at startup
    try {
      const snapshotName = Config.App.get("imjs_offline_imodel");
      if (snapshotName) {
        window.localStorage.setItem("imjs_offline_imodel", snapshotName);
        window.localStorage.setItem("imjs_test_project", "");
        window.localStorage.setItem("imjs_test_imodel", "");
      }
    } catch (e) {}

    // Otherwise, if project/iModel are configured in .env.local, then cache them in local storage
    // to use for auto-opening at startup
    const localSnapshotName = window.localStorage.getItem("imjs_offline_imodel");
    if (localSnapshotName && localSnapshotName.length > 0)
      initState.wantSnapshot = true;
    else {
      let projectName: string | null = null;
      let imodelName: string | null = null;

      try {
        imodelName = Config.App.get("imjs_test_imodel");
        projectName = Config.App.get("imjs_test_project", imodelName as string);
      } catch (e) {}

      if (projectName && imodelName) {
        window.localStorage.setItem("imjs_test_project", projectName);
        window.localStorage.setItem("imjs_test_imodel", imodelName);
      } else {
        // Check if we cached a snapshot or project/iModel to reuse
        projectName = window.localStorage.getItem("imjs_test_project");
        imodelName = window.localStorage.getItem("imjs_test_imodel");
        const snapshotPath = window.localStorage.getItem("imjs_offline_imodel");
        // If nothing was cached, then cache a default snapshot name
        if (!snapshotPath && (!projectName || !imodelName)) {
          const defaultSnapshot = this.getDefaultSnapshot();
          window.localStorage.setItem("imjs_offline_imodel", defaultSnapshot);
          window.localStorage.setItem("imjs_test_project", "");
          window.localStorage.setItem("imjs_test_imodel", "");
          initState.wantSnapshot = true;
        } else if (snapshotPath)
          initState.wantSnapshot = true;
      }
    }
    return initState;
  }

  public componentDidMount() {
    SampleApp.oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
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
  private _onIModelSelected = async (imodel: IModelConnection | undefined) => {
    if (!imodel) {
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
      UiFramework.setIModelConnection(undefined);
      return;
    }
    try {
      // attempt to get ViewState for the first available view definition
      const viewState = await this.getFirstViewDefinition(imodel);
      if (viewState) {
        this.setState(
          { imodel, viewState, isOpening: false },
          () => { AppUi.handleIModelViewsSelected(imodel, viewState); },
        );
      }
    } catch (e) {
      // if failed, close the imodel and reset the state
      await imodel.close();
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
      alert(e.message);
    }
  }

  /** The component's render method */
  public render() {
    let ui: React.ReactNode;

    if (this.state.user.isLoading) {
      // if OIDC is initializing or user is currently being loaded, just show that
      ui = <span style={{ marginLeft: "8px", marginTop: "8px" }}>{IModelApp.i18n.translate("SampleApp:signing-in")}...</span>;
    } else if (!SampleApp.oidcClient.hasSignedIn && !this.state.wantSnapshot) {
      ui = (<SignIn onSignIn={this._onStartSignin} onRegister={this._onRegister} />);
    } else if (this.state.isOpening) {
      // if iModel is currently being opened, just show that
      ui = <span style={{ marginLeft: "8px", marginTop: "8px" }}>{IModelApp.i18n.translate("SampleApp:opening")}...</span>;
    } else if (!this.state.imodel || !this.state.viewState) {
      SampleApp.store.dispatch({ type: "App:OPEN_IT" });
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
      window.localStorage.setItem("imjs_test_project", "");
      window.localStorage.setItem("imjs_test_imodel", "");
      window.localStorage.setItem("imjs_offline_imodel", filenames[0]);

      const currentIModelConnection = UiFramework.getIModelConnection();
      if (currentIModelConnection) {
        SyncUiEventDispatcher.clearConnectionEvents(currentIModelConnection);
        await currentIModelConnection.close();
        UiFramework.setIModelConnection(undefined);
      }
      SampleApp.store.dispatch({ type: "App:OPEN_IT" });
    } else
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
  }

  private _handleOpen = async () => {

    let wantSnapshot = this.state.wantSnapshot;
    if (this.state.isAutoOpening) {
      // If snapshot file is specified on command line args, override cached snapshot file
      const args: any[] = await ArgReaderRpcInterface.getClient().fetchArgs();
      if (args && args.length > 0) {
        const snapshotName = args[0];
        if (snapshotName && snapshotName.length > 0) {
          window.localStorage.setItem("imjs_offline_imodel", snapshotName);
          wantSnapshot = true;
        }
      }
    }

    this.setState({ isOpening: true, isAutoOpening: false, wantSnapshot });

    if (wantSnapshot)
      return this._handleOpenSnapshot();

    return this._handleOpenImodel();
  }

  private _handleOpenSnapshot = async () => {

    let localSnapshotName = window.localStorage.getItem("imjs_offline_imodel");
    if (!localSnapshotName || localSnapshotName.length === 0)
      localSnapshotName = this.getDefaultSnapshot();

    let imodel: IModelConnection | undefined;
    try {
      // attempt to open the imodel
      imodel = await SnapshotConnection.openFile(localSnapshotName);
    } catch (e) {
      window.localStorage.setItem("imjs_offline_imodel", "");
      const errMsg = IModelApp.i18n.translate("SampleApp:errorOpenSnapshot", {localSnapshotName, e});
      const con = this.getRemote().getGlobal("console");
      con.log(errMsg);
      window.close();
      process.exit(0);
    }

    if (imodel) {
      await this._onIModelSelected(imodel);
      window.localStorage.setItem("imjs_offline_imodel", localSnapshotName);
      window.localStorage.setItem("imjs_test_project", "");
      window.localStorage.setItem("imjs_test_imodel", "");
    } else {
      window.localStorage.setItem("imjs_offline_imodel", "");
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
    }
  }

  private _handleOpenImodel = async () => {
    const projectName = window.localStorage.getItem("imjs_test_project");
    const imodelName = window.localStorage.getItem("imjs_test_imodel");
    if (!projectName || !imodelName) {
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
      return;
    }
    const requestContext: AuthorizedFrontendRequestContext = await AuthorizedFrontendRequestContext.create();
    const connectClient = new ContextRegistryClient();
    let project: Project;
    try {
      project = await connectClient.getProject(requestContext, { $filter: `Name+eq+'${projectName}'` });
    } catch (e) {
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
      throw new Error(IModelApp.i18n.translate("SampleApp:noProject", {projectName}));
    }

    const imodelQuery = new IModelQuery();
    imodelQuery.byName(imodelName);
    const imodels = await IModelApp.iModelClient.iModels.get(requestContext, project.wsgId, imodelQuery);
    if (imodels.length === 0) {
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
      throw new Error(IModelApp.i18n.translate("SampleApp:noIModel", {imodelName, projectName}));
    }
    this.setState({ isOpening: true });

    let imodel: IModelConnection | undefined;
    imodel = await RemoteBriefcaseConnection.open(project.wsgId, imodels[0].wsgId, OpenMode.Readonly);

    window.localStorage.setItem("imjs_offline_imodel", "");

    await this._onIModelSelected(imodel);
  }
}

/** React props for [[IModelComponents]] component */
interface IModelComponentsProps {
  selectIModel?: boolean;
  selectSnapshot?: () => void;
  openIModel?: () => void;
}

/** Renders a viewport and a property grid */
class IModelComponents extends React.PureComponent<IModelComponentsProps> {

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
