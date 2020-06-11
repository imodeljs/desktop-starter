/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ViewState } from "@bentley/imodeljs-frontend";
import {
  BackstageManager, BasicNavigationWidget, ContentGroup, ContentLayoutDef, ContentViewManager, CoreTools, CustomItemDef, Frontstage,
  FrontstageProvider, IModelConnectedViewSelector, IModelViewportControl,
  ItemList, StagePanel, SyncUiEventId, ToolbarHelper, ToolWidget, UiFramework, Widget, WidgetState, Zone, ZoneState,
} from "@bentley/ui-framework";
import { PropertyGridWidget } from "../widgets/PropertyGridWidget";

/**
 * Sample Frontstage
 */
export class SampleFrontstage extends FrontstageProvider {

  // Content layout for content views
  private _contentLayoutDef: ContentLayoutDef;

  // Content group for both layouts
  private _contentGroup: ContentGroup;

  constructor(public viewStates: ViewState) {
    super();

    this._contentLayoutDef = new ContentLayoutDef({});
    this._contentGroup = new ContentGroup({
      contents: [
        {
          classId: IModelViewportControl,
          applicationData: {
            viewState: this.viewStates,
            iModelConnection: UiFramework.getIModelConnection(),
          },
        },
      ],
    });
  }

  private get _additionalNavigationVerticalToolbarItems() {
    return [
      ToolbarHelper.createToolbarItemFromItemDef(200, this._viewSelectorItemDef)];
  }

  /** Define the Frontstage properties */
  public get frontstage() {

    return (
      <Frontstage id="SampleFrontstage"
        defaultTool={CoreTools.selectElementCommand} defaultLayout={this._contentLayoutDef} contentGroup={this._contentGroup}
        isInFooterMode={true}

        topLeft={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<SampleToolWidget />} />,
            ]}
          />
        }
        topRight={
          <Zone
            widgets={[
              /** Use standard NavigationWidget delivered in ui-framework */
              <Widget isFreeform={true} element={<BasicNavigationWidget additionalVerticalItems={this._additionalNavigationVerticalToolbarItems} />} />,
            ]}
          />
        }
        bottomRight={
          <Zone defaultState={ZoneState.Open} allowsMerging={true}
            widgets={[
              <Widget id="Properties" control={PropertyGridWidget} defaultState={WidgetState.Closed} fillZone={true}
                iconSpec="icon-properties-list" labelKey="SampleApp:components.properties"
                applicationData={{
                  iModelConnection: UiFramework.getIModelConnection(),
                }}
                syncEventIds={[SyncUiEventId.SelectionSetChanged]}
                stateFunc={this._determineWidgetStateForSelectionSet}
              />,
            ]}
          />
        }
        rightPanel={
          <StagePanel
            allowedZones={[6, 9]}
          />
        }
      />
    );
  }

  /** Determine the WidgetState based on the Selection Set */
  private _determineWidgetStateForSelectionSet = (): WidgetState => {
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport && (activeContentControl.viewport.view.iModel.selectionSet.size > 0))
      return WidgetState.Open;
    return WidgetState.Closed;
  }

  /** Get the CustomItemDef for ViewSelector  */
  private get _viewSelectorItemDef() {
    return new CustomItemDef({
      customId: "sampleApp:viewSelector",
      reactElement: (
        <IModelConnectedViewSelector
          listenForShowUpdates={false}  // Demo for showing only the same type of view in ViewSelector - See IModelViewport.tsx, onActivated
        />
      ),
    });
  }

}

/**
 * Define a ToolWidget with Buttons to display in the TopLeft zone.
 */
class SampleToolWidget extends React.Component {

  public render(): React.ReactNode {
    const horizontalItems = new ItemList([
      CoreTools.selectElementCommand,
    ]);

    return (
      <ToolWidget
        appButton={BackstageManager.getBackstageToggleCommand()}
        horizontalItems={horizontalItems}
      />
    );
  }
}
