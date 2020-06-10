/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelInfo, IModelSelector } from "@bentley/imodel-select-react";
import { SampleApp } from "../../app/SampleApp";
import { ConfigurableCreateInfo, ContentControl, ContentGroup, ContentLayoutDef, CoreTools, Frontstage,
  FrontstageManager, FrontstageProps, FrontstageProvider, SyncUiEventDispatcher, UiFramework,
} from "@bentley/ui-framework";

class IModelSelectorControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <IModelSelector onIModelSelected={this._onSelectIModel} showSignoutButton={true} showBackstageButton={true} />;
  }

  // called when an imodel has been selected on the IModelSelect
  private _onSelectIModel = async (iModelInfo: IModelInfo) => {

    FrontstageManager.closeModalFrontstage();
    window.localStorage.setItem("imjs_test_project", iModelInfo.projectInfo.name);
    window.localStorage.setItem("imjs_test_imodel", iModelInfo.name);
    window.localStorage.setItem("imjs_offline_imodel", "");

    const currentIModelConnection = UiFramework.getIModelConnection();
    if (currentIModelConnection) {
      SyncUiEventDispatcher.clearConnectionEvents(currentIModelConnection);
      await currentIModelConnection.close();
      UiFramework.setIModelConnection(undefined);
    }

    SampleApp.store.dispatch({type: "App:OPEN_IT"});
  }
}

export class IModelSelectFrontstage extends FrontstageProvider {

  // Content layout for content views
  private _contentLayoutDef: ContentLayoutDef;

  constructor() {
    super();

    // Create the content layouts.
    this._contentLayoutDef = new ContentLayoutDef({});
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      contents: [
        {
          classId: IModelSelectorControl,
        },
      ],
    });

    return (
      <Frontstage id="IModelSelector"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={this._contentLayoutDef}
        contentGroup={contentGroup}
        isInFooterMode={false}
      />
    );
  }
}