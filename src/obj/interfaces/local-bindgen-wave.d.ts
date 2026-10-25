/** @module Interface local:bindgen/wave **/
export function format(ty: Array<TypeNode>, value: Array<ValueNode>): string;
export function parse(ty: Array<TypeNode>, text: string): Array<ValueNode>;
export type TypeNode = TypeNodeBool | TypeNodeS8 | TypeNodeS16 | TypeNodeS32 | TypeNodeS64 | TypeNodeU8 | TypeNodeU16 | TypeNodeU32 | TypeNodeU64 | TypeNodeF32 | TypeNodeF64 | TypeNodeChar | TypeNodeString | TypeNodeList | TypeNodeRecord | TypeNodeTuple | TypeNodeVariant | TypeNodeEnum | TypeNodeOption | TypeNodeResult | TypeNodeFlags | TypeNodeHandle;
export interface TypeNodeBool {
  tag: 'bool',
}
export interface TypeNodeS8 {
  tag: 's8',
}
export interface TypeNodeS16 {
  tag: 's16',
}
export interface TypeNodeS32 {
  tag: 's32',
}
export interface TypeNodeS64 {
  tag: 's64',
}
export interface TypeNodeU8 {
  tag: 'u8',
}
export interface TypeNodeU16 {
  tag: 'u16',
}
export interface TypeNodeU32 {
  tag: 'u32',
}
export interface TypeNodeU64 {
  tag: 'u64',
}
export interface TypeNodeF32 {
  tag: 'f32',
}
export interface TypeNodeF64 {
  tag: 'f64',
}
export interface TypeNodeChar {
  tag: 'char',
}
export interface TypeNodeString {
  tag: 'string',
}
export interface TypeNodeList {
  tag: 'list',
  val: number,
}
export interface TypeNodeRecord {
  tag: 'record',
  val: Array<[string, number]>,
}
export interface TypeNodeTuple {
  tag: 'tuple',
  val: Uint32Array,
}
export interface TypeNodeVariant {
  tag: 'variant',
  val: Array<[string, number | undefined]>,
}
export interface TypeNodeEnum {
  tag: 'enum',
  val: Array<string>,
}
export interface TypeNodeOption {
  tag: 'option',
  val: number,
}
export interface TypeNodeResult {
  tag: 'result',
  val: [number | undefined, number | undefined],
}
export interface TypeNodeFlags {
  tag: 'flags',
  val: Array<string>,
}
export interface TypeNodeHandle {
  tag: 'handle',
}
export type ValueNode = ValueNodeBool | ValueNodeS8 | ValueNodeS16 | ValueNodeS32 | ValueNodeS64 | ValueNodeU8 | ValueNodeU16 | ValueNodeU32 | ValueNodeU64 | ValueNodeF32 | ValueNodeF64 | ValueNodeChar | ValueNodeString | ValueNodeList | ValueNodeRecord | ValueNodeTuple | ValueNodeVariant | ValueNodeEnum | ValueNodeOption | ValueNodeResult | ValueNodeFlags | ValueNodeHandle;
export interface ValueNodeBool {
  tag: 'bool',
  val: boolean,
}
export interface ValueNodeS8 {
  tag: 's8',
  val: number,
}
export interface ValueNodeS16 {
  tag: 's16',
  val: number,
}
export interface ValueNodeS32 {
  tag: 's32',
  val: number,
}
export interface ValueNodeS64 {
  tag: 's64',
  val: bigint,
}
export interface ValueNodeU8 {
  tag: 'u8',
  val: number,
}
export interface ValueNodeU16 {
  tag: 'u16',
  val: number,
}
export interface ValueNodeU32 {
  tag: 'u32',
  val: number,
}
export interface ValueNodeU64 {
  tag: 'u64',
  val: bigint,
}
export interface ValueNodeF32 {
  tag: 'f32',
  val: number,
}
export interface ValueNodeF64 {
  tag: 'f64',
  val: number,
}
export interface ValueNodeChar {
  tag: 'char',
  val: string,
}
export interface ValueNodeString {
  tag: 'string',
  val: string,
}
export interface ValueNodeList {
  tag: 'list',
  val: Uint32Array,
}
export interface ValueNodeRecord {
  tag: 'record',
  val: Uint32Array,
}
export interface ValueNodeTuple {
  tag: 'tuple',
  val: Uint32Array,
}
export interface ValueNodeVariant {
  tag: 'variant',
  val: [string, number | undefined],
}
export interface ValueNodeEnum {
  tag: 'enum',
  val: string,
}
export interface ValueNodeOption {
  tag: 'option',
  val: number | undefined,
}
export interface ValueNodeResult {
  tag: 'result',
  val: Result<number | undefined, number | undefined>,
}
export interface ValueNodeFlags {
  tag: 'flags',
  val: Array<string>,
}
export interface ValueNodeHandle {
  tag: 'handle',
  val: string,
}
export type Result<T, E> = { tag: 'ok', val: T } | { tag: 'err', val: E };
