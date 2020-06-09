/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RpcManager } from "@bentley/imodeljs-common";
import { ArgReaderRpcInterface } from "../common/ArgReaderRpcInterface";

export class ArgReaderRpcImpl extends ArgReaderRpcInterface {
  public static register() { RpcManager.registerImpl(ArgReaderRpcInterface, ArgReaderRpcImpl); }
  public static args: any[];

  public static setArgs(args: any[]) {
    ArgReaderRpcImpl.args = args;
  }

  public async fetchArgs(): Promise<any[]> {
    return ArgReaderRpcImpl.args;
  }
}
