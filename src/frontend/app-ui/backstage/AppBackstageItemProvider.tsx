/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@bentley/imodeljs-frontend";
import { SampleApp } from "../../app/SampleApp";
import { BackstageItem, BackstageItemUtilities } from "@bentley/ui-abstract";

export class AppBackstageItemProvider {
  /** id of provider */
  public readonly id = "sample-app.AppBackstageItemProvider";

  private _backstageItems: ReadonlyArray<BackstageItem> | undefined = undefined;

  public get backstageItems(): ReadonlyArray<BackstageItem> {
    if (!this._backstageItems) {
      const selectIModel = BackstageItemUtilities.createActionItem("SelectIModel", 300, 30, () =>
        SampleApp.store.dispatch({ type: "App:SELECT_IMODEL"}),
        IModelApp.i18n.translate("SampleApp:backstage.selectIModel"), undefined, "icon-placeholder");
      const selectSnapshot = BackstageItemUtilities.createActionItem("SelectSnapshot", 300, 40, () =>
        SampleApp.store.dispatch({ type: "App:SELECT_SNAPSHOT"}),
        IModelApp.i18n.translate("SampleApp:backstage.selectSnapshot"), undefined, "icon-placeholder");

      this._backstageItems = [selectIModel, selectSnapshot];
    }
    return this._backstageItems;
  }
}
