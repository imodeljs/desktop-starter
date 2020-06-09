/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RpcInterface, RpcManager } from "@bentley/imodeljs-common";

export abstract class ArgReaderRpcInterface extends RpcInterface {

  public static interfaceVersion = "1.0.0";
  public static interfaceName = "ArgReaderRpcInterface";

  public static getClient(): ArgReaderRpcInterface { return RpcManager.getClientForInterface(this); }
  public async fetchArgs (): Promise<any[]> { return this.forward.apply(this, arguments as any) as any; }
}
