const IDL = await import('./wit');
export const Op = IDL.Enum(['add']);
export default IDL.Interface('docs:calculator/calculate@0.1.0', {
  'evalExpression': IDL.Func([['op', Op], ['x', IDL.U32], ['y', IDL.U32], ], [IDL.U32])
})