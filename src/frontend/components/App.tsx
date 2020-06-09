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
  viewStates?: ViewState[];
  isAutoOpening: boolean;     // is auto-opening or switching
  isSnapshot: boolean;        // current model is snapshot
  wantSnapshot: boolean;      // selecting snapshot?
  isSelecting: boolean;       // is selecting another snapshot/iModel
  isOpening: boolean;         // is opening another snapshot/iModel
}

/** A component the renders the whole application UI */
export default class App extends React.Component<{}, AppState> {

  /** Creates an App instance */
  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = this.initialize();
  }

  private getRemote(): any {
    return require("electron").remote;
  }

  private getDefaultSnapshot(): string {
    let defaultPath = "assets";
    if (this.getRemote().app.isPackaged)
      defaultPath = path.join("resources", "app", "assets");
    return path.join(defaultPath, "Campus.bim");
  }

  private initialize(): any {
    const initState = {
      user: {
        isAuthorized: SampleApp.oidcClient.isAuthorized,
        isLoading: false,
      },
      imodel: undefined, viewStates: undefined,
      isAutoOpening: true,
      isSnapshot: false,
      wantSnapshot: false,
      isSelecting: false,
      isOpening: false,
    };

    // If a snapshot is configured in config.json, then cache in local storage
    // to use for auto-opening at startup
    try {
      const snapshotName: string | null = ""; // Config.App.get("imjs_offline_imodel");
      if (snapshotName) {
        window.localStorage.setItem("imjs_offline_imodel", snapshotName);
        window.localStorage.setItem("imjs_test_project", "");
        window.localStorage.setItem("imjs_test_imodel", "");
      }
    } catch (e) {}

    // Otherwise, if project/imodel are configured in config.json, then cache them in local storage
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
        // Check if we cached a snapshot or project/imodel to reuse
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
    SampleApp.store.subscribe(async () => {
      const switchState = SampleApp.store.getState().switchIModelState!.switchState;
      if (switchState === SwitchState.SelectIModel || switchState === SwitchState.SelectSnapshot) {
        const snapshot: boolean = switchState === SwitchState.SelectSnapshot;
        this.setState({ isSelecting: true, wantSnapshot: snapshot });
      } else if (switchState === SwitchState.OpenIt)
        this.setState({ imodel: undefined, viewStates: undefined, isSelecting: false });
    });

    const onOpenedListener = async (_iModel: IModelConnection) => {
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE"});
    };

    IModelConnection.onOpen.addListener(onOpenedListener);

    SampleApp.oidcClient.onUserStateChanged.addListener(this._onUserStateChanged);
  }

  public componentWillUnmount() {
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

  /** Pick the first two available spatial, orthographic or drawing view definitions in the imodel */
  private async getFirstTwoViewDefinitions(imodel: IModelConnection): Promise<ViewState[]> {
    const viewSpecs = await imodel.views.queryProps({});
    const acceptedViewClasses = [
      "BisCore:SpatialViewDefinition",
      "BisCore:DrawingViewDefinition",
      "BisCore:OrthographicViewDefinition",
    ];
    const acceptedViewSpecs = viewSpecs.filter((spec) => (-1 !== acceptedViewClasses.indexOf(spec.classFullName)));
    if (1 > acceptedViewSpecs.length)
      throw new Error("No valid view definitions in imodel");

    const viewStates: ViewState[] = [];
    for (const viewDef of acceptedViewSpecs) {
      const viewState = await imodel.views.load(viewDef.id!);
      viewStates.push(viewState);
    }

    return viewStates;
  }

  /** Handle iModel open event */
  private _onIModelSelected = async (imodel: IModelConnection | undefined) => {
    if (!imodel) {
      // reset the state when imodel is closed
      this.setState({ imodel: undefined, viewStates: undefined, isSelecting: true, isOpening: false });
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
      UiFramework.setIModelConnection(undefined);
      return;
    }
    try {
      // attempt to get ViewState for the first two available view definitions
      const viewStates = await this.getFirstTwoViewDefinitions(imodel);
      if (viewStates) {
        this.setState(
          { imodel, viewStates, isOpening: false },
          () => { AppUi.handleIModelViewsSelected(imodel, viewStates); },
        );
      }
    } catch (e) {
      // if failed, close the imodel and reset the state
      await imodel.close();

      // Don't stay in selecting state if we were selecting a snapshot
      const isSelecting: boolean = this.state.wantSnapshot ? false : true;
      this.setState({ imodel: undefined, viewStates: undefined, isSelecting, isOpening: false });
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
      alert(e.message);
    }
  }

    /** The component's render method */
  public render() {
    let ui: React.ReactNode;

    if (this.state.user.isLoading) {
      // if OIDC is initializing or user is currently being loaded, just tell that
      ui = <span style={{ marginLeft: "8px", marginTop: "8px" }}>{IModelApp.i18n.translate("SampleApp:signing-in")}...</span>;
    } else if (!SampleApp.oidcClient.hasSignedIn && !this.state.wantSnapshot) {
      ui = (<SignIn onSignIn={this._onStartSignin} onRegister={this._onRegister} />);
    } else if (this.state.isOpening) {
      // if model is currently being opened, just tell that
      ui = <span style={{ marginLeft: "8px", marginTop: "8px" }}>{IModelApp.i18n.translate("SampleApp:opening")}...</span>;
    } else if (this.state.isSelecting) {
      if (this.state.wantSnapshot)
        ui = <IModelComponents selectSnapshot={this._handleSelectSnapshot}/>;
      else {
        ui = <IModelComponents selectIModel={true}/>;
      }
    } else if (!this.state.imodel || !this.state.viewStates) {
      ui = <IModelComponents openIModel={this._handleOpen}/>;
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
    } else {
      this.setState({isSelecting: false, isOpening: false });
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
    }
  }

  private _handleOpen = async () => {

    if (this.state.isAutoOpening) {
      // If snapshot file is specified on command line args, override cached snapshot file
      const args: any[] = await ArgReaderRpcInterface.getClient().fetchArgs();
      if (args && args.length > 0) {
        const snapshotName = args[0];
        if (snapshotName && snapshotName.length > 0) {
          window.localStorage.setItem("imjs_offline_imodel", snapshotName);
          this.setState({ wantSnapshot: true });
        }
      }
    }
    if (this.state.wantSnapshot)
      return this._handleOpenSnapshot();

    return this._handleOpenImodel();
  }

  private _handleOpenSnapshot = async () => {

    let localSnapshotName = window.localStorage.getItem("imjs_offline_imodel");
    if (!localSnapshotName || localSnapshotName.length === 0)
      localSnapshotName = this.getDefaultSnapshot();

    this.setState({ isOpening: true, isSnapshot: true, isAutoOpening: false });

    let imodel: IModelConnection | undefined;
    try {
      // attempt to open the imodel
      imodel = await SnapshotConnection.openFile(localSnapshotName);
    } catch (e) {
      window.localStorage.setItem("imjs_offline_imodel", "");
      const errMsg = "Error opening snapshot: " + localSnapshotName + " -- " + e;

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
      this.setState({isSelecting: false, isOpening: false });
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
      throw new Error(`Project with name "${projectName}" does not exist`);
    }

    const imodelQuery = new IModelQuery();
    imodelQuery.byName(imodelName);
    const imodels = await IModelApp.iModelClient.iModels.get(requestContext, project.wsgId, imodelQuery);
    if (imodels.length === 0) {
      SampleApp.store.dispatch({ type: "App:CLEAR_STATE" });
      throw new Error(`iModel with name "${imodelName}" does not exist in project "${projectName}"`);
    }
    this.setState({ isOpening: true, isSnapshot: false });

    let imodel: IModelConnection | undefined;
    imodel = await RemoteBriefcaseConnection.open(project.wsgId, imodels[0].wsgId, OpenMode.Readonly);

    window.localStorage.setItem("imjs_offline_imodel", "");

    await this._onIModelSelected(imodel);
  }
}

/** React props for [[OpenIModelButton]] component */
interface IModelComponentsProps {
  selectIModel?: boolean;
  selectSnapshot?: () => void;
  openIModel?: () => void;
}

/** Renders a viewport, a tree, a property grid and a table */
class IModelComponents extends React.PureComponent<IModelComponentsProps> {

  private _provider = new AppBackstageItemProvider();

  public componentDidMount() {
    UiItemsManager.register(this._provider);
  }

  public componentWillUnmount() {
    UiItemsManager.unregister(this._provider.id);
  }

  public render() {
    if (this.props.selectIModel) {
      const frontstageDef = FrontstageManager.findFrontstageDef("IModelSelector");
      FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises
    } else if (this.props.selectSnapshot)
      this.props.selectSnapshot();
    else if (this.props.openIModel)
      this.props.openIModel();

    return (
      <ConfigurableUiContent appBackstage={<AppBackstageComposer />} />
    );
  }
}
