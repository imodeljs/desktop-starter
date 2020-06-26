/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Settings */

import { Toggle } from "@bentley/ui-core";
import { ColorTheme, ModalFrontstageInfo, UiFramework, UiShowHideManager } from "@bentley/ui-framework";
import * as React from "react";
import "./Settings.scss";

/** Modal frontstage displaying the active settings. */
export class SettingsModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("App:settingsStage.settings");
  public get content(): React.ReactNode { return (<SettingsPage />); }
}

/** SettingsPage displaying the active settings. */
class SettingsPage extends React.Component<{}> {
  private _themeTitle: string = UiFramework.i18n.translate("App:settingsStage.themeTitle");
  private _themeDescription: string = UiFramework.i18n.translate("App:settingsStage.themeDescription");
  private _useProximityOpacityTitle: string = UiFramework.i18n.translate("App:settingsStage.useProximityOpacityTitle");
  private _useProximityOpacityDescription: string = UiFramework.i18n.translate("App:settingsStage.useProximityOpacityDescription");

  private _onThemeChange = () => {
    const theme = this._isLightTheme() ? ColorTheme.Dark : ColorTheme.Light;
    UiFramework.setColorTheme(theme);
  }

  private _isLightTheme(): boolean {
    return (UiFramework.getColorTheme() === ColorTheme.Light);
  }

  private _onAutoHideChange = () => {
    UiShowHideManager.autoHideUi = !UiShowHideManager.autoHideUi;
  }

  private _onUseProximityOpacityChange = () => {
    UiShowHideManager.useProximityOpacity = !UiShowHideManager.useProximityOpacity;
  }

  public render(): React.ReactNode {
    const isLightTheme = this._isLightTheme();
    const _theme: string = UiFramework.i18n.translate((isLightTheme) ? "App:settingsStage.light" : "App:settingsStage.dark");
    return (
      <div className="uifw-settings">
        <div className="uifw-settings-item">
          <div className="panel left-panel">
            <span className="title">{this._themeTitle}</span>
            <span className="description">{this._themeDescription}</span>
          </div>
          <div className="panel right-panel">
            <Toggle isOn={isLightTheme} showCheckmark={false} onChange={this._onThemeChange} />
            &nbsp;&nbsp;
            {_theme}
          </div>
        </div>
        <div className="uifw-settings-item">
          <div className="panel left-panel">
            <span className="title">{this._useProximityOpacityTitle}</span>
            <span className="description">{this._useProximityOpacityDescription}</span>
          </div>
          <div className="panel right-panel">
            <Toggle isOn={UiShowHideManager.useProximityOpacity} showCheckmark={false} onChange={this._onUseProximityOpacityChange} />
          </div>
        </div>
      </div>
    );
  }
}
