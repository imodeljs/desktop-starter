/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelReadRpcInterface, IModelTileRpcInterface, RpcInterfaceDefinition, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import { PresentationRpcInterface } from "@bentley/presentation-common";

export interface ViewerConfig {
  snapshotName?: string;
  sampleiModelPath: string;
  project?: {
    iModel: string;
    name: string;
  };
  clientId: string;
  redirectUri: string;
}

// ipc channel name for this application
export const dtsChannel = "dts";
// Ipc interface for this application.
export interface DtsInterface {
  getConfig: () => Promise<ViewerConfig>;
}

/* Returns a list of RPCs required by this application */
export function getRpcInterfaces(): RpcInterfaceDefinition[] {
  return [
    IModelReadRpcInterface,
    IModelTileRpcInterface,
    PresentationRpcInterface,
    SnapshotIModelRpcInterface,
  ];
}
