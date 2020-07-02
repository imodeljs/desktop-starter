/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { StatusBarSection } from "@bentley/ui-abstract";
import {
  FooterModeField, MessageCenterField, SectionsStatusField, SelectionScopeField, StatusBarComposer,
  StatusBarItem, StatusBarItemUtilities, StatusBarWidgetControl, StatusBarWidgetControlArgs,
  ToolAssistanceField, withMessageCenterFieldProps, withStatusFieldProps,
} from "@bentley/ui-framework";
import { FooterSeparator } from "@bentley/ui-ninezone";

const ToolAssistance = withStatusFieldProps(ToolAssistanceField); // tslint:disable-line: variable-name
const MessageCenter = withMessageCenterFieldProps(MessageCenterField); // tslint:disable-line: variable-name
const Sections = withStatusFieldProps(SectionsStatusField); // tslint:disable-line: variable-name
const SelectionScope = withStatusFieldProps(SelectionScopeField); // tslint:disable-line: variable-name
const FooterOnlyDisplay = withStatusFieldProps(FooterModeField); // tslint:disable-line: variable-name

/**
 * Status Bar widget control
 */
export class AppStatusBarWidget extends StatusBarWidgetControl {
  private _statusBarItems?: StatusBarItem[];

  private get footerModeOnlySeparator(): React.ReactNode {
    return (<FooterOnlyDisplay> <FooterSeparator /> </FooterOnlyDisplay>);
  }

  private get statusBarItems(): StatusBarItem[] {
    if (!this._statusBarItems) {
      const statusBarItems: StatusBarItem[] = [];

      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 10, <MessageCenter />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("Separator1", StatusBarSection.Left, 15, this.footerModeOnlySeparator));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 20, <ToolAssistance />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("Separator2", StatusBarSection.Left, 25, this.footerModeOnlySeparator));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("Sections", StatusBarSection.Center, 20, <Sections hideWhenUnused={true} />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("SelectionScope", StatusBarSection.Right, 10, <SelectionScope />));

      this._statusBarItems = statusBarItems;
    }
    return this._statusBarItems;
  }

  public getReactNode(_args: StatusBarWidgetControlArgs): React.ReactNode {
    return (
      <StatusBarComposer items={this.statusBarItems} />
    );
  }
}
