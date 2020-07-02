/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { combineReducers, createStore, Store } from "redux";

import {
  ActionsUnion, createAction, DeepReadonly, FrameworkReducer, FrameworkState,
} from "@bentley/ui-framework";

// Valid values for SwitchIModelState.switchState
export enum SwitchState {
  None = 0,
  SelectIModel = 1,
  SelectSnapshot = 2,
  OpenIModel = 3,
  OpenSnapshot = 4,
}

export interface SelectedIModel {
  imodelName: string;
  projectName: string;
}

// State handling for switching iModels
export interface SwitchIModelState {
  switchState: SwitchState;
  selectedIModel: SelectedIModel | null;
  selectedSnapshot: string;
}

const initialState: SwitchIModelState = {
  switchState: SwitchState.None,
  selectedIModel: null,
  selectedSnapshot: "",
};

// tslint:disable-next-line:variable-name
export const SwitchIModelActions = {
  selectIModel: () => createAction("App:SELECT_IMODEL", {}),
  selectSnapshot: () => createAction("App:SELECT_SNAPSHOT", {}),
  openIModel: (selectedIModel: SelectedIModel) => createAction("App:OPEN_IMODEL", selectedIModel),
  openSnapshot: (selectedSnapshot: string) => createAction("App:OPEN_SNAPSHOT", selectedSnapshot),
};

export type SwitchIModelActionsUnion = ActionsUnion<typeof SwitchIModelActions>;

function AppReducer(state: SwitchIModelState = initialState, action: SwitchIModelActionsUnion): DeepReadonly<SwitchIModelState> {
  switch (action.type) {
    case "App:SELECT_IMODEL":
      return { ...state, switchState: SwitchState.SelectIModel };
    case "App:SELECT_SNAPSHOT":
      return { ...state, switchState: SwitchState.SelectSnapshot };
    case "App:OPEN_IMODEL":
      return { ...state, switchState: SwitchState.OpenIModel, selectedIModel: action.payload };
    case "App:OPEN_SNAPSHOT":
      return { ...state, switchState: SwitchState.OpenSnapshot, selectedSnapshot: action.payload };
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
