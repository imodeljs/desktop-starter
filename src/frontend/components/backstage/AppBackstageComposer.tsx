/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";

import { IModelApp } from "@bentley/imodeljs-frontend";
import { UserInfo } from "@bentley/itwin-client";
import { BackstageItemUtilities } from "@bentley/ui-abstract";
import { BackstageComposer, UserProfileBackstageItem } from "@bentley/ui-framework";

import { App } from "../../app/App";
import { RootState } from "../../app/AppState";

function mapStateToProps(state: RootState) {
  const frameworkState = state.frameworkState;

  if (!frameworkState)
    return undefined;

  return { userInfo: frameworkState.sessionState.userInfo };
}

interface AppBackstageComposerProps {
  /** AccessToken from sign-in */
  userInfo: UserInfo | undefined;
}

export function AppBackstageComposerComponent({ userInfo }: AppBackstageComposerProps) {
  const [backstageItems] = React.useState(() => [
    BackstageItemUtilities.createActionItem("SelectIModel", 100, 30, () => App.store.dispatch({ type: "App:SELECT_IMODEL" }),
      IModelApp.i18n.translate("App:backstage.selectIModel"), undefined, "icon-placeholder"),
    BackstageItemUtilities.createActionItem("SelectSnapshot", 100, 40, () => App.store.dispatch({ type: "App:SELECT_SNAPSHOT" }),
      IModelApp.i18n.translate("App:backstage.selectSnapshot"), undefined, "icon-placeholder"),
  ]);

  return (
    <BackstageComposer
      header={userInfo && <UserProfileBackstageItem userInfo={userInfo} />}
      items={backstageItems}
    />
  );
}

export const AppBackstageComposer = connect(mapStateToProps)(AppBackstageComposerComponent); // tslint:disable-line:variable-name
