// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as WebSocketWS from 'ws';
import { traceError } from '../../common/logger';
import { KernelSocketWrapper } from '../kernelSocketWrapper';
import { IKernelSocket } from '../types';

// tslint:disable: no-any
export const JupyterWebSockets = new Map<string, WebSocketWS & IKernelSocket>(); // NOSONAR

// We need to override the websocket that jupyter lab services uses to put in our cookie information
// Do this as a function so that we can pass in variables the the socket will have local access to
export function createJupyterWebSocket(cookieString?: string, allowUnauthorized?: boolean, xAuthToken?: string) {
    class JupyterWebSocket extends KernelSocketWrapper(WebSocketWS) {
        private kernelId: string | undefined;

        constructor(url: string, protocols?: string | string[] | undefined) {
            let co: WebSocketWS.ClientOptions = {};

            if (allowUnauthorized) {
                co = { ...co, rejectUnauthorized: false };
            }

            const headers: { [key: string]: string } = {};

            if (cookieString) {
                headers.Cookie = cookieString;
            }

            if (xAuthToken) {
                headers['X-AUTH-TOKEN'] = xAuthToken;
            }

            if (cookieString) {
                co = {
                    ...co,
                    headers: headers
                };
            }

            super(url, protocols, co);

            // Parse the url for the kernel id
            const parsed = /.*\/kernels\/(.*)\/.*/.exec(url);
            if (parsed && parsed.length > 1) {
                this.kernelId = parsed[1];
            }
            if (this.kernelId) {
                JupyterWebSockets.set(this.kernelId, this);
                this.on('close', () => {
                    JupyterWebSockets.delete(this.kernelId!);
                });
            } else {
                traceError('KernelId not extracted from Kernel WebSocket URL');
            }
        }
    }
    return JupyterWebSocket;
}
