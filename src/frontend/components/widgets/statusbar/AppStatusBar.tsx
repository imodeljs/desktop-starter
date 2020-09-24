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

/* eslint-disable @typescript-eslint/naming-convention */
const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
const Sections = withStatusFieldProps(SectionsStatusField);
const SelectionScope = withStatusFieldProps(SelectionScopeField);
const FooterOnlyDisplay = withStatusFieldProps(FooterModeField);
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Status Bar widget control
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class AppStatusBarWidget extends StatusBarWidgetControl {
  private _statusBarItems?: StatusBarItem[];

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private get footerModeOnlySeparator(): React.ReactNode {
    return (<FooterOnlyDisplay> <FooterSeparator /> </FooterOnlyDisplay>);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
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
