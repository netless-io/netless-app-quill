// The bridge between netless app storage and Yjs.
// For 1.0 implementation see https://github.com/netless-io/y.

import type { NetlessApp } from '@netless/fastboard'
import { disposableStore } from '@wopjs/disposable'
import { ObservableV2 } from 'lib0/observable'

import * as Y from "yjs";
import { uint8ArrayToBase64, base64ToUint8Array } from "uint8array-extras";

export type AppContext = Parameters<NetlessApp['setup']>[0]
export type Storage = AppContext['storage']
export type AnyDict = { [key in PropertyKey]: any }

export interface VectorEvents {
  update: (data: any) => void
}

export class Vector extends ObservableV2<VectorEvents> {
  readonly dispose = disposableStore()
  readonly storage: Storage
  readonly clientId: string

  clock = 1
  
  constructor(readonly context: AppContext, namespace: string) {
    super()
    
    this.storage = context.createStorage<AnyDict>(namespace, {})
    this.clientId = context.getRoom()?.uid || Math.random().toString(36).slice(2, 8)

    this.dispose.add(this.storage.addStateChangedListener((diff) => {
      Object.keys(diff).forEach((key) => {
        const [clientId, _clock] = key.split("@");
        if (clientId === this.clientId) return;
        const one = diff[key];
        const update = one && one.newValue;
        update && this.emit("update", [update]);
      });
    }))

    Object.keys(this.storage.state).forEach((key) => {
      const [clientId, clock] = key.split("@");
      if (clientId === this.clientId) {
        this.clock = Math.max(this.clock, Number(clock) + 1);
      }
    });
  }

  get size() {
    return Object.keys(this.storage.state).length;
  }

  forEach(callback: (update: any, index: number) => void) {
    const state = this.storage.state;
    Object.keys(state).forEach((key, i) => callback(state[key], i));
  }

  push(update: any) {
    if (!this.context.getIsWritable()) return;
    this.storage.setState({ [this.clientId + "@" + this.clock++]: update });
  }

  swap(updates: Array<any>) {
    if (!this.context.getIsWritable()) return;
    this.storage.emptyStorage();
    let newState: Record<string, any> = {};
    for (const update of updates) {
      newState[this.clientId + "@" + this.clock++] = update;
    }
    this.storage.setState(newState);
  }

  override destroy(): void {
    this.dispose();
    super.destroy();
  }
}

export function createVector(context: AppContext, namespace: string) {
  return new Vector(context, namespace);
}

export interface ConnectOptions {
  /**
   * Shrink vector size when it is bigger than this number.
   * default: 1000
   */
  optimizeAt?: number;
}

export function connect(
  vector: Vector,
  doc: Y.Doc,
  { optimizeAt = 1000 }: ConnectOptions = {}
) {
  if (optimizeAt <= 0) {
    throw new Error("[optimizeAt] must be greater than 0");
  }

  const remoteOrigin = "remote";

  // restore state
  vector.forEach((update: string) => {
    Y.applyUpdate(doc, base64ToUint8Array(update), remoteOrigin);
  });

  // doc -> vector -> other clients
  function onDocUpdate(update: Uint8Array, origin: unknown) {
    if (origin !== remoteOrigin) {
      vector.push(uint8ArrayToBase64(update));
      if (vector.size > optimizeAt) {
        vector.swap([uint8ArrayToBase64(Y.encodeStateAsUpdate(doc))]);
      }
    }
  }
  doc.on("update", onDocUpdate);
  const disposeDocListener = () => doc.off("update", onDocUpdate);

  // other clients -> vector -> doc
  function onVectorUpdate(update: string) {
    Y.applyUpdate(doc, base64ToUint8Array(update), remoteOrigin);
  }
  vector.on("update", onVectorUpdate);
  const disposeVectorListener = () => vector.off("update", onVectorUpdate);

  return function dispose() {
    disposeVectorListener();
    disposeDocListener();
  };
}
