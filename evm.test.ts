import { expect, test } from "@jest/globals";
import evm from "./evm";
import tests from "./evm.json";

export interface Tx {
  to?: string;
  from?: string;
  origin?: string;
  gasprice?: string;
  value?: string;
  data?: string;
  nonce?: string;
}
export interface Block {
  basefee?: string;
  coinbase?: string;
  timestamp?: string;
  number?: string;
  difficulty?: string;
  gaslimit?: string;
  chainid?: string;
}

export interface Account {
  balance?: string;
  code?: {
    bin?: string;
  };
}
export interface State {
  [key: string]: Account;
}

for (const t of tests as any) {
  test(t.name, () => {
    const result = evm(
      hexStringToUint8Array(t.code.bin),
      t.tx,
      t.block,
      t.state !== undefined ? t.state : {},
      false,
      false
    );

    expect(result.success).toEqual(t.expect.success);
    if ("stack" in t.expect) {
      expect(result.stack).toEqual(
        t.expect.stack.map((item: string) => BigInt(item))
      );
    }
    if ("logs" in t.expect) {
      expect(result.logs).toEqual(t.expect.logs);
    }
    if ("return" in t.expect) {
      expect(result.returnValue).toEqual(t.expect.return);
    }
  });
}

export function hexStringToUint8Array(hexString: string) {
  return new Uint8Array(
    (hexString?.match(/../g) || []).map((byte) => parseInt(byte, 16))
  );
}
