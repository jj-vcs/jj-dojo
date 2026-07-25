/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// We may not be the only ones using the channel. These are unique
// ids to filter out noises.
const REQUEST_PROTOCOL_ID = 'jj-dojo-rpc-protocol-request';
const RESPONSE_PROTOCOL_ID = 'jj-dojo-rpc-protocol-response';
const HANDSHAKE_PROTOCOL_ID = 'jj-dojo-rpc-protocol-handshake';

interface RpcRequest {
  rpcProtocolId: string;
  data: {
    name: string;
    args: unknown[];
    id: number;
  };
}

/**
 * Returns true if the provided event is a RPC request.
 */
export function isRpcRequest(event: unknown): event is RpcRequest {
  return Boolean(
    event &&
    typeof event === 'object' &&
    'rpcProtocolId' in event &&
    event.rpcProtocolId === REQUEST_PROTOCOL_ID,
  );
}

/**
 * Creates a RPC request.
 */
export function createRpcRequest(data: RpcRequest['data']): RpcRequest {
  return {
    rpcProtocolId: REQUEST_PROTOCOL_ID,
    data,
  };
}

interface RpcResponse {
  rpcProtocolId: string;
  data: {
    id: number;
    response?: unknown;
    err?: unknown;
  };
}

/**
 * Returns true if the provided event is a RPC response.
 */
export function isRpcResponse(event: unknown): event is RpcResponse {
  return Boolean(
    event &&
    typeof event === 'object' &&
    'rpcProtocolId' in event &&
    event.rpcProtocolId === RESPONSE_PROTOCOL_ID,
  );
}

/**
 * Creates a RPC response.
 */
export function createRpcResponse(data: RpcResponse['data']): RpcResponse {
  return {
    rpcProtocolId: RESPONSE_PROTOCOL_ID,
    data,
  };
}

interface HandShakeMessage {
  rpcProtocolId: string;
  received: boolean;
}

/**
 * Returns true if the provided event is a handshake message.
 */
export function isHandShakeMessage(event: unknown): event is HandShakeMessage {
  return Boolean(
    event &&
    typeof event === 'object' &&
    'rpcProtocolId' in event &&
    event.rpcProtocolId === HANDSHAKE_PROTOCOL_ID,
  );
}

/**
 * Creates a handshake message.
 */
export function createHandShakeMessage(
  data: Omit<HandShakeMessage, 'rpcProtocolId'>,
): HandShakeMessage {
  return {
    rpcProtocolId: HANDSHAKE_PROTOCOL_ID,
    ...data,
  };
}
