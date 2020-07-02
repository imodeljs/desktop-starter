/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { IModelApp } from "@bentley/imodeljs-frontend";
import { Button, ButtonSize, ButtonType, FillCentered, Headline } from "@bentley/ui-core";
import {
  BackstageAppButton, ConfigurableCreateInfo, ContentControl, ContentGroup, ContentLayoutDef,
  CoreTools, Frontstage, FrontstageManager, FrontstageProps, FrontstageProvider, ToolWidgetComposer,
  Widget, Zone,
} from "@bentley/ui-framework";

import { App } from "../../app/App";

class SnapshotSelectControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <LocalFilePage />;
  }
}

/** SnapshotSelectFrontstage displays the file open picker. */
export class SnapshotSelectFrontstage extends FrontstageProvider {

  // Content layout for content views
  private _contentLayoutDef: ContentLayoutDef;

  constructor() {
    super();

    // Create the content layouts.
    this._contentLayoutDef = new ContentLayoutDef({});
  }

  public static async open() {
    const frontstageProvider = new SnapshotSelectFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      contents: [
        {
          classId: SnapshotSelectControl,
        },
      ],
    });

    return (
      <Frontstage id="SnapshotSelector"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={this._contentLayoutDef}
        contentGroup={contentGroup}
        isInFooterMode={false}
        contentManipulationTools={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<ToolWidgetComposer cornerItem={<BackstageAppButton/>}/>} />,
            ]}
          />
        }
      />
    );
  }
}

/** LocalFilePage displays the file picker. */
class LocalFilePage extends React.Component {
  private _input: HTMLInputElement | null = null;

  public componentDidMount() {
    if (this._input) {
      this._clickInput();
    }
  }

  private _clickInput = () => {
    if (this._input) {
      this._input.click();
    }
  }

  private _handleChange = async (_e: React.ChangeEvent) => {
    if (this._input) {
      if (this._input.files && this._input.files.length) {
        const file: File = this._input.files[0];
        if (file) {
          try {
            App.store.dispatch({type: "App:OPEN_SNAPSHOT", payload: file.path});
          } catch (e) {
            alert(e.message);
          }
        }
      }
    }
  }

  public render() {
    const title = IModelApp.i18n.translate("App:snapshotSelect.title");
    const buttonLabel = IModelApp.i18n.translate("App:snapshotSelect.open");

    return (
      <>
        <div style={{ position: "absolute", top: "16px", left: "100px" }}>
          <Headline>{title}</Headline>
        </div>
        <FillCentered>
          <input id="file-input" ref={(e) => this._input = e}
            type="file" accept=".bim,.ibim" onChange={this._handleChange}
            style={{ display: "none" }} />
          <Button size={ButtonSize.Large} buttonType={ButtonType.Primary} onClick={this._clickInput}>
            {buttonLabel}
          </Button>
        </FillCentered >
      </>
    );
  }
}
