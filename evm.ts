import { keccak256, getContractAddress } from "ethers/lib/utils";
import { hexStringToUint8Array, Tx, Block, State, Account } from "./evm.test";

const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639936n;

function memoryHelper(
  memory: string,
  value: string,
  offset: string,
  len: number,
  fill: boolean,
  mstore: boolean
) {
  let memSize = +offset + len;
  while ((memSize & 31) > 0) {
    ++memSize;
  }
  while (memory.length >> 1 < memSize) {
    memory += "00";
  }
  if (fill) {
    return memory;
  }
  const array = memory.match(/.{1,2}/g) ?? [];
  if (len === 1) {
    value = value.slice(-2);
    array[+offset] = value;
  } else {
    if (mstore) {
      while (value.length < 64) {
        value = "0" + value;
      }
    }
    const valueHelper = value.match(/.{1,2}/g) ?? [];
    for (let i = 0, arrI = +offset; i < len; ++i) {
      array[arrI] = valueHelper[i];
      ++arrI;
    }
  }
  return array.join("");
}

function mloadData(memory: string, offset: string, len: number) {
  const start = +offset << 1;
  const end = start + len;
  if (!memory.length) {
    memory = memoryHelper(memory, "", offset, 32, true, false);
  }
  let helper: string;
  if (memory.length < end) {
    helper = memory.slice(start);
    while (helper.length < 64) {
      helper += "00";
    }
  } else {
    helper = memory.slice(start, end);
  }
  return { helper, memory };
}

type Storage = {
  [key: string]: string;
};
type Logs = {
  address: string;
  data: string;
  topics: string[];
};

interface CallResult {
  success: boolean;
  stack: bigint[];
  logs: Logs[];
  returnValue: string;
  returnDataSize?: number;
  storage?: Storage;
  state?: State;
}

export default function evm(
  code: Uint8Array,
  tx: Tx,
  block: Block,
  state: State,
  call: boolean,
  delegatecall: boolean
): CallResult {
  let pc = 0;
  const stack: bigint[] = [];
  let memory = "";
  let storage: Storage = {};
  const logs: Logs[] = [];
  let log: Logs = { address: "", data: "", topics: [] };
  let returnValue: string = "";
  let callCode: Uint8Array;
  let callResult: CallResult = {
    success: false,
    stack: [],
    logs: [],
    returnValue: "",
  };
  let returnDataSize = 0;
  let newAccount: Account = {};

  let len = 0;
  let end = 0;

  const one = BigInt(1);
  const zero = BigInt(0);
  let value1 = zero;
  let value2 = zero;
  let value3 = zero;
  let value4 = zero;
  let value5 = zero;
  let value6 = zero;
  let value7 = zero;

  let helper1 = "";
  let helper2 = "";
  let helper3 = "";
  let minus = false;
  let resultBigInt = zero;
  let resultBool = false;

  while (pc < code.length) {
    switch (code[pc]) {
      case 0x00: // STOP
        pc = code.length;
        break;

      case 0x01: // ADD
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        stack.unshift((value1 + value2) % MAX_UINT256);
        break;

      case 0x02: // MUL
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        stack.unshift((value1 * value2) % MAX_UINT256);
        break;

      case 0x03: // SUB
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value1 >= value2) {
          stack.unshift(value1 - value2);
        } else {
          stack.unshift(MAX_UINT256 - (value2 - value1));
        }
        break;

      case 0x04: // DIV
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value2 > 0) {
          resultBigInt = value1 / value2;
          if (resultBigInt >= 1) {
            stack.unshift(resultBigInt);
          } else {
            stack.unshift(zero);
          }
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x05: // SDIV
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value2 !== zero) {
          helper1 = value1.toString(2);
          helper2 = value2.toString(2);
          if (helper1.length === 256 && helper2.length === 256) {
            value1 = MAX_UINT256 - value1;
            value2 = MAX_UINT256 - value2;
          } else if (helper1.length === 256) {
            value1 = MAX_UINT256 - value1;
            minus = true;
          } else if (helper2.length === 256) {
            value2 = MAX_UINT256 - value2;
            minus = true;
          }
          let result = value1 / value2;
          if (result >= 1) {
            if (minus) {
              result = MAX_UINT256 - result;
            }
            stack.unshift(result);
          } else {
            stack.unshift(zero);
          }
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x06: // MOD
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value2 > 0) {
          stack.unshift(value1 % value2);
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x07: // SMOD
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value2 !== zero) {
          helper1 = value1.toString(2);
          helper2 = value2.toString(2);
          if (helper1.length === 256 && helper2.length === 256) {
            value1 = MAX_UINT256 - value1;
            value2 = MAX_UINT256 - value2;
            minus = true;
          } else if (helper1.length === 256) {
            value1 = MAX_UINT256 - value1;
            minus = true;
          } else if (helper2.length === 256) {
            value2 = MAX_UINT256 - value2;
            minus = true;
          }
          let result = value1 % value2;
          if (result >= 1) {
            if (minus) {
              result = MAX_UINT256 - result;
            }
            stack.unshift(result);
          } else {
            stack.unshift(zero);
          }
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x08: // ADDMOD
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        if (value3 > 0) {
          stack.unshift((value1 + value2) % value3);
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x09: // MULMOD
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        if (value3 > 0) {
          stack.unshift((value1 * value2) % value3);
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x0a: // EXP
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        stack.unshift(value1 ** value2 % MAX_UINT256);
        break;

      case 0x0b: // SIGNEXTEND
        stack.shift();
        value1 = stack.shift() ?? zero;
        helper1 = value1.toString(2);
        while ((helper1.length & 3) !== 0) {
          helper1 = "0" + helper1;
        }
        if (+helper1[0] === 1) {
          helper1 = value1.toString(16);
          while ((helper1.length & 63) !== 0) {
            helper1 = "ff" + helper1;
          }
          stack.unshift(BigInt(`0x${helper1}`));
        } else {
          stack.unshift(value1);
        }
        break;

      case 0x10: // LT
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value1 < value2) {
          stack.unshift(one);
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x11: // GT
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value1 > value2) {
          stack.unshift(one);
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x12: // SLT
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        helper1 = value1.toString(2);
        helper2 = value2.toString(2);
        if (helper1.length === 256 && helper2.length === 256) {
          value1 = MAX_UINT256 - value1;
          value2 = MAX_UINT256 - value2;

          resultBool = value1 > value2;
        } else if (helper1.length === 256) {
          resultBool = true;
        } else if (helper1.length < 256 && helper2.length < 256) {
          resultBool = value1 < value2;
        }
        if (resultBool) {
          stack.unshift(one);
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x13: // SGT
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        resultBool = false;
        helper1 = value1.toString(2);
        helper2 = value2.toString(2);
        if (helper1.length === 256 && helper2.length === 256) {
          value1 = MAX_UINT256 - value1;
          value2 = MAX_UINT256 - value2;
          resultBool = value1 < value2;
        } else if (helper2.length === 256) {
          resultBool = true;
        } else if (helper1.length < 256 && helper2.length < 256) {
          resultBool = value1 > value2;
        }
        if (resultBool) {
          stack.unshift(one);
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x14: // EQ
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value1 === value2) {
          stack.unshift(one);
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x15: // ISZERO
        value1 = stack.shift() ?? zero;
        if (value1 === zero) {
          stack.unshift(one);
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x16: // AND
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        stack.unshift(value1 & value2);
        break;

      case 0x17: // OR
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        stack.unshift(value1 | value2);
        break;

      case 0x18: // XOR
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        stack.unshift(value1 ^ value2);
        break;

      case 0x19: // NOT
        value1 = stack.shift() ?? zero;
        if (value1.toString(2).length !== 256) {
          value1 = MAX_UINT256 - -~value1;
        } else {
          value1 = ~value1;
        }
        stack.unshift(value1);
        break;

      case 0x1a: // BYTE
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        helper1 = value2.toString(16);
        while (helper1.length < 64) {
          helper1 = "0" + helper1;
        }
        if (value1 >= BigInt(32)) {
          stack.unshift(zero);
        } else {
          helper2 = (value1 << one).toString();
          helper3 += helper1[+helper2] + helper1[+helper2 + 1];
          stack.unshift(BigInt(`0x${helper3}`));
        }
        break;

      case 0x1b: // SHL
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value1 > 0xff) {
          stack.unshift(zero);
        } else {
          stack.unshift((value2 << value1) % MAX_UINT256);
        }
        break;

      case 0x1c: // SHR
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        stack.unshift(value2 >> value1);
        break;

      case 0x1d: // SAR
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        helper1 = value2.toString(2);
        if (value1 < 0xff) {
          if (helper1.length === 256) {
            resultBigInt = value2 >> value1;
            helper2 = resultBigInt.toString(16);
            while (helper2.length < 64) {
              helper2 = "f" + helper2;
            }
            stack.unshift(BigInt(`0x${helper2}`));
          } else {
            stack.unshift(value2 >> value1);
          }
        } else {
          if (helper1.length === 256) {
            stack.unshift(MAX_UINT256 - one);
          } else {
            stack.unshift(zero);
          }
        }
        break;

      case 0x20: // SHA3
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        helper1 = value1.toString(10);
        helper2 = value2.toString(10);
        helper3 = memory.slice(+helper1, +helper1 + (+helper2 << 1));
        stack.unshift(BigInt(keccak256(hexStringToUint8Array(helper3))));
        break;

      case 0x30: // ADDRESS
        try {
          stack.unshift(BigInt(`${tx.to}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x31: // BALANCE
        value1 = stack.shift() ?? zero;
        helper1 = `0x${value1.toString(16)}`;
        try {
          stack.unshift(BigInt(state[helper1].balance ?? ""));
        } catch (er: any) {
          stack.unshift(zero);
        }
        break;

      case 0x32: // ORIGIN
        try {
          stack.unshift(BigInt(`${tx.origin}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x33: // CALLER
        try {
          stack.unshift(BigInt(`${tx.from}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x34: // CALLVALUE
        try {
          stack.unshift(BigInt(`${tx.value}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x35: // CALLDATALOAD
        value1 = stack.shift() ?? zero;
        if ("data" in tx) {
          helper1 = (+value1.toString(10) << 1).toString(10);
          helper2 = tx.data ?? "";
          if (helper2.length > +helper1) {
            if (helper2.length < +helper1 + 64) {
              helper2 = `0x${helper2.slice(+helper1)}`;
              while (helper2.length < 66) {
                helper2 += "00";
              }
              stack.unshift(BigInt(helper2));
            } else {
              helper2 = `0x${helper2.slice(+helper1, +helper1 + 64)}`;
              stack.unshift(BigInt(helper2));
            }
          } else {
            stack.unshift(zero);
          }
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x36: // CALLDATASIZE
        try {
          if (tx.data) {
            stack.unshift(BigInt(tx.data.length >> 1));
          }
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x37: // CALLDATACOPY
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        if ("data" in tx) {
          helper1 = (+value2.toString(10) << 1).toString(10);
          helper2 = tx.data ?? "";
          helper3 = (+value3.toString(10) << 1).toString(10);
          if (helper2.length > +helper1) {
            if (helper2.length < +helper1 + +helper3) {
              helper2 = helper2.slice(+helper1);
              while (helper2.length < +helper3) {
                helper2 += "00";
              }
              memory = memoryHelper(
                memory,
                helper2,
                value1.toString(10),
                +helper3 >> 1,
                false,
                false
              );
            } else {
              helper2 = helper2.slice(+helper1, +helper1 + +helper3);
              memory = memoryHelper(
                memory,
                helper2,
                value1.toString(10),
                +helper3 >> 1,
                false,
                false
              );
            }
          }
        } else {
          memory = memoryHelper(
            memory,
            "",
            value1.toString(10),
            32,
            true,
            false
          );
        }
        break;

      case 0x38: // CODESIZE
        stack.unshift(BigInt(code.length));
        break;

      case 0x39: // CODECOPY
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        helper1 = (+value2.toString(10) << 1).toString(10);
        const array = code.join(",").split(",");
        for (let i = 0; i < array.length; ++i) {
          array[i] = (+array[i]).toString(16);
          if (array[i].length < 2) {
            array[i] = "0" + array[i];
          }
        }
        helper2 = array.join("");
        helper3 = (+value3.toString(10) << 1).toString(10);
        if (helper2.length > +helper1) {
          if (helper2.length < +helper1 + +helper3) {
            helper2 = helper2.slice(+helper1);
            while (helper2.length < +helper3) {
              helper2 += "00";
            }
            memory = memoryHelper(
              memory,
              helper2,
              value1.toString(10),
              +helper3 >> 1,
              false,
              false
            );
          } else {
            helper2 = helper2.slice(+helper1, +helper1 + +helper3);
            memory = memoryHelper(
              memory,
              helper2,
              value1.toString(10),
              +helper3 >> 1,
              false,
              false
            );
          }
        }
        break;

      case 0x3a: // GASPRICE
        try {
          stack.unshift(BigInt(`${tx.gasprice}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x3b: // EXTCODESIZE
        value1 = stack.shift() ?? zero;
        helper1 = `0x${value1.toString(16)}`;
        try {
          helper2 = state[helper1].code?.bin ?? "";
          stack.unshift(BigInt(helper2.length >> 1));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x3c: // EXTCODECOPY
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        value4 = stack.shift() ?? zero;
        helper1 = `0x${value1.toString(16)}`;
        try {
          helper2 = state[helper1].code?.bin ?? "";
          helper1 = (+value3.toString(10) << 1).toString(10);
          helper3 = (+value4.toString(10) << 1).toString(10);
          if (helper2.length > +helper1) {
            if (helper2.length < +helper1 + +helper3) {
              helper2 = helper2.slice(+helper1);
              while (helper2.length < +helper3) {
                helper2 += "00";
              }
              memory = memoryHelper(
                memory,
                helper2,
                value2.toString(10),
                +helper3 >> 1,
                false,
                false
              );
            } else {
              helper2 = helper2.slice(+helper1, +helper1 + +helper3);
              memory = memoryHelper(
                memory,
                helper2,
                value2.toString(10),
                +helper3 >> 1,
                false,
                false
              );
            }
          }
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x3d: // RETURNDATASIZE
        stack.unshift(BigInt(returnDataSize));
        break;

      case 0x3e: // RETURNDATACOPY
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        helper1 = (+value2.toString(10) << 1).toString(10);
        helper2 = callResult.returnValue;
        helper3 = (+value3.toString(10) << 1).toString(10);
        if (helper2.length > +helper1) {
          if (helper2.length < +helper1 + +helper3) {
            helper2 = helper2.slice(+helper1);
            while (helper2.length < +helper3) {
              helper2 += "00";
            }
            memory = memoryHelper(
              memory,
              helper2,
              value1.toString(10),
              +helper3 >> 1,
              false,
              false
            );
          } else {
            helper2 = helper2.slice(+helper1, +helper1 + +helper3);
            memory = memoryHelper(
              memory,
              helper2,
              value1.toString(10),
              +helper3 >> 1,
              false,
              false
            );
          }
        }
        break;

      case 0x3f: // EXTCODEHASH
        value1 = stack.shift() ?? zero;
        helper1 = `0x${value1.toString(16)}`;
        try {
          helper2 = state[helper1].code?.bin ?? "";
          stack.unshift(BigInt(keccak256(hexStringToUint8Array(helper2))));
        } catch (err: any) {
          stack.unshift(zero);
        }

        break;

      case 0x40: // BLOCKHASH
        stack.shift();
        stack.unshift(zero);
        break;

      case 0x41: // COINBASE
        try {
          stack.unshift(BigInt(`${block.coinbase}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x42: // TIMESTAMP
        try {
          stack.unshift(BigInt(`${block.timestamp}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x43: // NUMBER
        try {
          stack.unshift(BigInt(`${block.number}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x44: // PREVRANDAO
        try {
          stack.unshift(BigInt(`${block.difficulty}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x45: // GASLIMIT
        try {
          stack.unshift(BigInt(`${block.gaslimit}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x46: // CHAINID
        try {
          stack.unshift(BigInt(`${block.chainid}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x47: // SELFBALANCE
        try {
          if (tx.to) {
            stack.unshift(BigInt(state[tx.to].balance ?? ""));
          }
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x48: // BASEFEE
        try {
          stack.unshift(BigInt(`${block.basefee}`));
        } catch (err: any) {
          stack.unshift(zero);
        }
        break;

      case 0x50: // POP
        stack.shift();
        break;

      case 0x51: // MLOAD
        value1 = stack.shift() ?? zero;
        const mloadResult = mloadData(memory, value1.toString(10), 64);
        stack.unshift(BigInt(`0x${mloadResult.helper}`));
        memory = mloadResult.memory;
        break;

      case 0x52: // MSTORE
      case 0x53: // MSTORE8
        len = code[pc] - 0x52;
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        memory = memoryHelper(
          memory,
          value2.toString(16),
          value1.toString(10),
          len === 0 ? 32 : len,
          false,
          len === 0 ? true : false
        );
        break;

      case 0x54: // SLOAD
        value1 = stack.shift() ?? zero;
        helper1 = `0x${value1.toString(16)}`;
        if (helper1 in storage) {
          stack.unshift(BigInt(storage[helper1]));
        } else {
          stack.unshift(zero);
        }
        break;

      case 0x55: // SSTORE
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        helper1 = `0x${value1.toString(16)}`;
        if (value2 === zero && helper1 in storage) {
          delete storage[helper1];
        } else {
          helper2 = `0x${value2.toString(16)}`;
          storage[helper1] = helper2;
        }
        break;

      case 0x56: // JUMP
        value1 = stack.shift() ?? zero;
        helper1 = value1.toString();
        pc = +helper1 - 1;
        if (code[pc + 1] !== 0x5b || (code[pc] > 0x5f && code[pc] < 0x80)) {
          return { success: false, stack, logs, returnValue };
        }
        break;

      case 0x57: // JUMPI
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (value2 === one) {
          helper1 = value1.toString();
          pc = +helper1 - 1;
          if (code[pc + 1] !== 0x5b || (code[pc] > 0x5f && code[pc] < 0x80)) {
            return { success: false, stack, logs, returnValue };
          }
        }
        break;

      case 0x58: // PC
        stack.unshift(BigInt(pc));
        break;

      case 0x59: // MSIZE.
        stack.unshift(BigInt(memory.length >> 1));
        break;

      case 0x5a: // GAS
        stack.unshift(MAX_UINT256 - one);
        break;

      case 0x5b: // JUMPDEST
        break;

      case 0x60: // PUSH1
      case 0x61: // PUSH2
      case 0x62: // PUSH3
      case 0x63: // PUSH4
      case 0x64: // PUSH5
      case 0x65: // PUSH6
      case 0x66: // PUSH7
      case 0x67: // PUSH8
      case 0x68: // PUSH9
      case 0x69: // PUSH10
      case 0x6a: // PUSH11
      case 0x6b: // PUSH12
      case 0x6c: // PUSH13
      case 0x6d: // PUSH14
      case 0x6e: // PUSH15
      case 0x6f: // PUSH16
      case 0x70: // PUSH17
      case 0x71: // PUSH18
      case 0x72: // PUSH19
      case 0x73: // PUSH20
      case 0x74: // PUSH21
      case 0x75: // PUSH22
      case 0x76: // PUSH23
      case 0x77: // PUSH24
      case 0x78: // PUSH25
      case 0x79: // PUSH26
      case 0x7a: // PUSH27
      case 0x7b: // PUSH28
      case 0x7c: // PUSH29
      case 0x7d: // PUSH30
      case 0x7e: // PUSH31
      case 0x7f: // PUSH32
        len = code[pc] - 0x5f;
        end = pc + len;
        let result = "0x";
        let midResult = "";
        for (let i = pc + 1; i <= end; ++i) {
          midResult = `${code[i].toString(16)}`;
          if (midResult.length < 2) {
            midResult = "0" + midResult;
          }
          result += midResult;
        }
        stack.unshift(BigInt(result));
        pc += len;
        break;

      case 0x80: // DUP1
      case 0x81: // DUP2
      case 0x82: // DUP3
      case 0x83: // DUP4
      case 0x84: // DUP5
      case 0x85: // DUP6
      case 0x86: // DUP7
      case 0x87: // DUP8
      case 0x88: // DUP9
      case 0x89: // DUP10
      case 0x8a: // DUP11
      case 0x8b: // DUP12
      case 0x8c: // DUP13
      case 0x8d: // DUP14
      case 0x8e: // DUP15
      case 0x8f: // DUP16
        len = code[pc] - 0x80;
        stack.unshift(stack[len]);
        break;

      case 0x90: // SWAP1
      case 0x91: // SWAP2
      case 0x92: // SWAP3
      case 0x93: // SWAP4
      case 0x94: // SWAP5
      case 0x95: // SWAP6
      case 0x96: // SWAP7
      case 0x97: // SWAP8
      case 0x98: // SWAP9
      case 0x99: // SWAP10
      case 0x9a: // SWAP11
      case 0x9b: // SWAP12
      case 0x9c: // SWAP13
      case 0x9d: // SWAP14
      case 0x9e: // SWAP15
      case 0x9f: // SWAP16
        len = code[pc] - 0x8f;
        [stack[0], stack[len]] = [stack[len], stack[0]];
        break;

      case 0xa0: // LOG0
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        if (tx.to) {
          log.address = tx.to;
        }
        log.data = mloadData(
          memory,
          value1.toString(10),
          +value2.toString(10) << 1
        ).helper;
        logs.unshift(log);
        break;

      case 0xa1: // LOG1
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        if (tx.to) {
          log.address = tx.to;
        }
        log.data = mloadData(
          memory,
          value1.toString(10),
          +value2.toString(10) << 1
        ).helper;
        log.topics.push(`0x${value3.toString(16)}`);
        logs.unshift(log);
        break;

      case 0xa2: // LOG2
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        value4 = stack.shift() ?? zero;
        if (tx.to) {
          log.address = tx.to;
        }
        log.data = mloadData(
          memory,
          value1.toString(10),
          +value2.toString(10) << 1
        ).helper;
        log.topics.push(`0x${value3.toString(16)}`);
        log.topics.push(`0x${value4.toString(16)}`);
        logs.unshift(log);
        break;

      case 0xa3: // LOG3
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        value4 = stack.shift() ?? zero;
        value5 = stack.shift() ?? zero;
        if (tx.to) {
          log.address = tx.to;
        }
        log.data = mloadData(
          memory,
          value1.toString(10),
          +value2.toString(10) << 1
        ).helper;
        log.topics.push(`0x${value3.toString(16)}`);
        log.topics.push(`0x${value4.toString(16)}`);
        log.topics.push(`0x${value5.toString(16)}`);
        logs.unshift(log);
        break;

      case 0xa4: // LOG4
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        value4 = stack.shift() ?? zero;
        value5 = stack.shift() ?? zero;
        value6 = stack.shift() ?? zero;
        if (tx.to) {
          log.address = tx.to;
        }
        log.data = mloadData(
          memory,
          value1.toString(10),
          +value2.toString(10) << 1
        ).helper;
        log.topics.push(`0x${value3.toString(16)}`);
        log.topics.push(`0x${value4.toString(16)}`);
        log.topics.push(`0x${value5.toString(16)}`);
        log.topics.push(`0x${value6.toString(16)}`);
        logs.unshift(log);
        break;

      case 0xf0: // CREATE
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        helper1 = getContractAddress({
          from: tx.from ?? "",
          nonce: tx.nonce ?? zero,
        }).toLowerCase();
        helper2 = mloadData(
          memory,
          value2.toString(10),
          +value3.toString(10) << 1
        ).helper;
        if (value1 > zero) {
          newAccount.balance = `0x${value1.toString(16)}`;
        }
        if (helper2 != "") {
          callResult = evm(
            hexStringToUint8Array(helper2),
            {},
            block,
            state,
            false,
            false
          );
          if (!callResult.success) {
            stack.unshift(zero);
            break;
          }
          const code = { bin: callResult.returnValue };
          newAccount.code = code;
        }
        state[helper1] = newAccount;
        stack.unshift(BigInt(helper1));
        break;

      case 0xf1: // CALL
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        value4 = stack.shift() ?? zero;
        value5 = stack.shift() ?? zero;
        value6 = stack.shift() ?? zero;
        value7 = stack.shift() ?? zero;
        helper1 = `0x${value2.toString(16)}`;
        helper2 = mloadData(
          memory,
          value4.toString(10),
          +value5.toString(10) << 1
        ).helper;
        if (helper1 in state) {
          let callTx: Tx = {};
          if (tx) {
            callTx = {
              from: tx.to ?? "",
              origin: tx.origin ?? "",
              value: tx.value ?? "",
              gasprice: tx.gasprice ?? "",
            };
          }
          callTx.to = helper1;
          callTx.data = helper2;
          callCode = hexStringToUint8Array(state[helper1].code?.bin ?? "");
          callResult = evm(callCode, callTx, block, state, true, false);
          if (callResult.success) {
            stack.unshift(one);
          } else {
            stack.unshift(zero);
          }
          memory = memoryHelper(
            memory,
            callResult.returnValue,
            value6.toString(10),
            +value7.toString(10) << 1,
            false,
            false
          );
          returnDataSize = callResult.returnDataSize ?? 0;
          state = callResult.state ?? {};
        }
        break;

      case 0xf3: // RETURN
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        helper1 = value2.toString(10);
        returnValue = mloadData(
          memory,
          value1.toString(10),
          +helper1 << 1
        ).helper;
        if (call) {
          returnDataSize = +helper1;
        }
        pc = code.length;
        break;

      case 0xf4: // DELEGATECALL
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        value4 = stack.shift() ?? zero;
        value5 = stack.shift() ?? zero;
        value6 = stack.shift() ?? zero;
        helper1 = `0x${value2.toString(16)}`;
        helper2 = mloadData(
          memory,
          value3.toString(10),
          +value4.toString(10) << 1
        ).helper;
        if (helper1 in state) {
          let callTx: Tx = {};
          if (tx) {
            callTx = {
              to: tx.to ?? "",
              from: tx.origin ?? "",
              origin: tx.origin ?? "",
              value: tx.value ?? "",
              gasprice: tx.gasprice ?? "",
            };
          }
          callTx.data = helper2;
          callCode = hexStringToUint8Array(state[helper1].code?.bin ?? "");
          callResult = evm(callCode, callTx, block, state, true, true);
          if (callResult.success) {
            stack.unshift(one);
          } else {
            stack.unshift(zero);
          }
          memory = memoryHelper(
            memory,
            callResult.returnValue,
            value5.toString(10),
            +value6.toString(10) << 1,
            false,
            false
          );
          returnDataSize = callResult.returnDataSize ?? 0;
          storage = callResult.storage ?? {};
        }
        break;

      case 0xfa: // STATICCALL
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        value3 = stack.shift() ?? zero;
        value4 = stack.shift() ?? zero;
        value5 = stack.shift() ?? zero;
        value6 = stack.shift() ?? zero;
        helper1 = `0x${value2.toString(16)}`;
        helper2 = mloadData(
          memory,
          value3.toString(10),
          +value4.toString(10) << 1
        ).helper;
        if (helper1 in state) {
          callCode = hexStringToUint8Array(state[helper1].code?.bin ?? "");
          if (callCode.includes(0x55)) {
            stack.unshift(zero);
            break;
          }
          let callTx: Tx = {};
          if (tx) {
            callTx = {
              to: helper1,
              from: tx.to ?? "",
              origin: tx.origin ?? "",
              value: tx.value ?? "",
              gasprice: tx.gasprice ?? "",
              data: helper2,
            };
          }
          callResult = evm(callCode, callTx, block, state, true, false);
          if (callResult.success) {
            stack.unshift(one);
          } else {
            stack.unshift(zero);
          }
          memory = memoryHelper(
            memory,
            callResult.returnValue,
            value5.toString(10),
            +value6.toString(10) << 1,
            false,
            false
          );
          returnDataSize = callResult.returnDataSize ?? 0;
        }
        break;

      case 0xff: // SELFDESTRUCT
        value1 = stack.shift() ?? zero;
        helper1 = `0x${value1.toString(16)}`;
        if (tx.to) {
          newAccount.balance = state[tx.to].balance;
          delete state[tx.to];
        }
        state[helper1] = newAccount;
        break;

      case 0xfd: // REVERT
        value1 = stack.shift() ?? zero;
        value2 = stack.shift() ?? zero;
        helper1 = value2.toString(10);
        returnValue = mloadData(
          memory,
          value1.toString(10),
          +helper1 << 1
        ).helper;
        if (call) {
          returnDataSize = +helper1;
        }
        pc = code.length;
      case 0xfe: // INVALID
      default:
        return {
          success: false,
          stack,
          logs,
          returnValue,
          returnDataSize,
        };
    }
    ++pc;
  }

  return {
    success: true,
    stack,
    logs,
    returnValue,
    returnDataSize,
    storage: delegatecall ? storage : {},
    state,
  };
}
