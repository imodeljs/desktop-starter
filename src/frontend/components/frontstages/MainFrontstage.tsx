/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
// import { CommonToolbarItem, ToolbarOrientation, ToolbarUsage } from "@bentley/ui-abstract";
import {
  BasicNavigationWidget, BasicToolWidget, ContentGroup, ContentLayoutDef, ContentViewManager, CoreTools,
  CustomItemDef, Frontstage, FrontstageProvider, IModelViewportControl,
  SyncUiEventId, ToolbarHelper, UiFramework, ViewSelector, Widget, WidgetState, Zone, ZoneState,
} from "@bentley/ui-framework";
import { PropertyGridWidget } from "../widgets/PropertyGridWidget";
import { AppStatusBarWidget } from "../widgets/statusbar/AppStatusBar";

/**
 * Main Frontstage
 */
export class MainFrontstage extends FrontstageProvider {

  // Content layout for content views
  private _contentLayoutDef: ContentLayoutDef;

  // Content group for both layouts
  private _contentGroup: ContentGroup;

  constructor() {
    super();

    this._contentLayoutDef = new ContentLayoutDef({});
    this._contentGroup = new ContentGroup({
      contents: [
        {
          classId: IModelViewportControl,
          applicationData: {
            viewState: UiFramework.getDefaultViewState(),
            iModelConnection: UiFramework.getIModelConnection(),
            disableDefaultViewOverlay: true,
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
      <Frontstage id="MainFrontstage"
        defaultTool={CoreTools.selectElementCommand} defaultLayout={this._contentLayoutDef} contentGroup={this._contentGroup}
        isInFooterMode={true}

        contentManipulationTools={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<BasicToolWidget showCategoryAndModelsContextTools={false} />} />,
            ]}
          />
        }
        toolSettings={
          < Zone
            widgets={
              [
                <Widget isToolSettings={true} />,
              ]}
          />
        }
        viewNavigationTools={
          <Zone
            widgets={[
              /** Use standard NavigationWidget delivered in ui-framework */
              <Widget isFreeform={true} element={<BasicNavigationWidget additionalVerticalItems={this._additionalNavigationVerticalToolbarItems} />} />,
            ]}
          />
        }
        statusBar={
          < Zone
            widgets={
              [
                <Widget isStatusBar={true} control={AppStatusBarWidget} />,
              ]}
          />
        }
        bottomRight={
          <Zone defaultState={ZoneState.Open} allowsMerging={true}
            widgets={[
              <Widget id="Properties" control={PropertyGridWidget} defaultState={WidgetState.Closed} fillZone={true}
                iconSpec="icon-properties-list" labelKey="App:components.properties"
                applicationData={{
                  iModelConnection: UiFramework.getIModelConnection(),
                }}
                syncEventIds={[SyncUiEventId.SelectionSetChanged]}
                stateFunc={this._determineWidgetStateForSelectionSet}
              />,
            ]}
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
    const imodelConnection = UiFramework.getIModelConnection();
    return new CustomItemDef({
      customId: "App:viewSelector",
      reactElement: (
        <ViewSelector imodel={imodelConnection} listenForShowUpdates={false} />
      ),
    });
  }
}

// /**
//  * Define a ToolWidget with Buttons to display in the TopLeft zone.
//  */
// export function TopLeftToolWidget() {
//
//   const getVerticalToolbarItems = React.useCallback(
//     (): CommonToolbarItem[] => {
//       const items: CommonToolbarItem[] = [];
//       items.push(
//         ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.selectElementCommand),
//       );
//       return items;
//     }, []);
//
//   const [verticalItems, setVerticalItems] = React.useState(() => getVerticalToolbarItems());
//
//   const isInitialMount = React.useRef(true);
//   React.useEffect(() => {
//     if (isInitialMount.current)
//       isInitialMount.current = false;
//     else
//       setVerticalItems(getVerticalToolbarItems());
//   }, [getVerticalToolbarItems]);
//
//   return (
//     <ToolWidgetComposer
//       cornerItem={<BackstageAppButton />}
//       verticalToolbar={<ToolbarComposer items={verticalItems} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Vertical} />}
//     />
//   );
// }
