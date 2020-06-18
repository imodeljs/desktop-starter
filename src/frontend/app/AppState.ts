/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ActionsUnion, createAction, DeepReadonly, FrameworkReducer, FrameworkState } from "@bentley/ui-framework";
import { combineReducers, createStore, Store } from "redux";

// Valid values for SwitchIModelState.switchState
export enum SwitchState {
  None = 0,
  SelectIModel = 1,
  SelectSnapshot = 2,
  OpenIt = 3,
}

export interface SelectedIModel {
  imodelName: string;
  projectName: string;
}

// State handling for switching iModels
export interface SwitchIModelState {
  switchState: SwitchState;
  selectedIModel: SelectedIModel | null;
}

const initialState: SwitchIModelState = {
  switchState: SwitchState.None,
  selectedIModel: null,
};

// tslint:disable-next-line:variable-name
export const SwitchIModelActions = {
  selectIModel: () => createAction("App:SELECT_IMODEL", {}),
  selectSnapshot: () => createAction("App:SELECT_SNAPSHOT", {}),
  openIt: (selectedIModel: SelectedIModel) => createAction("App:OPEN_IT", selectedIModel),
};

export type SwitchIModelActionsUnion = ActionsUnion<typeof SwitchIModelActions>;

function AppReducer(state: SwitchIModelState = initialState, action: SwitchIModelActionsUnion): DeepReadonly<SwitchIModelState> {
  switch (action.type) {
    case "App:SELECT_IMODEL":
      return { ...state, switchState: SwitchState.SelectIModel };
    case "App:SELECT_SNAPSHOT":
      return { ...state, switchState: SwitchState.SelectSnapshot };
    case "App:OPEN_IT":
      return { ...state, switchState: SwitchState.OpenIt, selectedIModel: action.payload };
    default:
      return { ...state, switchState: SwitchState.None };
  }
}

// React-redux interface stuff
export interface RootState {
  switchIModelState: SwitchIModelState;
  frameworkState?: FrameworkState;
}

export type AppStore = Store<RootState>;

/**
 * Centralized state management class using  Redux actions, reducers and store.
 */
export class AppState {
  private _store: AppStore;
  private _rootReducer: any;

  constructor() {
    // this is the rootReducer for the application.
    this._rootReducer = combineReducers<RootState>({
      switchIModelState: AppReducer,
      frameworkState: FrameworkReducer,
    } as any);

    // create the Redux Store.
    this._store = createStore(this._rootReducer,
      (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__());
  }

  public get store(): Store<RootState> {
    return this._store;
  }

}
