const ReactDOM = globalThis.ReactDOM;
if (!ReactDOM || typeof ReactDOM.createRoot !== 'function') throw new Error('ReactDOM runtime 尚未載入');
export const createRoot = ReactDOM.createRoot.bind(ReactDOM);
export default ReactDOM;
