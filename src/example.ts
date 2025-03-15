const IDL = await import('./wit');
export const op = IDL.Enum(['add']);
export default IDL.Interface('docs:calculator/calculate@0.1.0', {
  'eval-expression': IDL.Func([['op', op], ['x', IDL.U32], ['y', IDL.U32], ], [IDL.U32])
})
