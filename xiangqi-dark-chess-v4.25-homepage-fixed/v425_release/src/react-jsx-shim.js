const React = globalThis.React;
if (!React) throw new Error('React runtime 尚未載入');
export const Fragment = React.Fragment;
export function jsx(type, props, key) { return React.createElement(type, { ...(props || {}), key }); }
export function jsxs(type, props, key) { return React.createElement(type, { ...(props || {}), key }); }
export function jsxDEV(type, props, key) { return React.createElement(type, { ...(props || {}), key }); }
