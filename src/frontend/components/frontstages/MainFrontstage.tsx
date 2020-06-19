/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ViewState } from "@bentley/imodeljs-frontend";
import { CommonToolbarItem, ToolbarOrientation, ToolbarUsage } from "@bentley/ui-abstract";
import {
  BackstageAppButton, BasicNavigationWidget, ContentGroup, ContentLayoutDef, CoreTools, CustomItemDef,
  Frontstage, FrontstageProvider, IModelConnectedViewSelector, IModelViewportControl, ToolbarComposer,
  ToolbarHelper, ToolWidgetComposer, UiFramework, Widget, Zone,
} from "@bentley/ui-framework";

/**
 * Main Frontstage
 */
export class MainFrontstage extends FrontstageProvider {

  // Content layout for content views
  private _contentLayoutDef: ContentLayoutDef;

  // Content group for both layouts
  private _contentGroup: ContentGroup;

  constructor(public viewState: ViewState) {
    super();

    this._contentLayoutDef = new ContentLayoutDef({});
    this._contentGroup = new ContentGroup({
      contents: [
        {
          classId: IModelViewportControl,
          applicationData: {
            viewState: this.viewState,
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
      <Frontstage id="MainFrontstage"
        defaultTool={CoreTools.selectElementCommand} defaultLayout={this._contentLayoutDef} contentGroup={this._contentGroup}
        isInFooterMode={true}

        contentManipulationTools={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<TopLeftToolWidget />} />,
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
      />
    );
  }

  /** Get the CustomItemDef for ViewSelector  */
  private get _viewSelectorItemDef() {
    return new CustomItemDef({
      customId: "App:viewSelector",
      reactElement: (
        <IModelConnectedViewSelector
          listenForShowUpdates={false}
        />
      ),
    });
  }

}

/**
 * Define a ToolWidget with Buttons to display in the TopLeft zone.
 */
export function TopLeftToolWidget() {

  const getVerticalToolbarItems = React.useCallback(
    (): CommonToolbarItem[] => {
      const items: CommonToolbarItem[] = [];
      items.push(
        ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.selectElementCommand),
      );
      return items;
    }, []);

  const [verticalItems, setVerticalItems] = React.useState(() => getVerticalToolbarItems());

  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else
      setVerticalItems(getVerticalToolbarItems());
  }, [getVerticalToolbarItems]);

  return (
    <ToolWidgetComposer
      cornerItem={<BackstageAppButton/>}
      verticalToolbar={<ToolbarComposer items={verticalItems} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Vertical} />}
      />
  );
}
