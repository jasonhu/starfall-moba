export {}

// 启动入口：先加载内核（内核自带模拟/渲染/音频/UI 全链路），再挂扩展。
const kernel = await import('./kernel/starfall.core')
const { installExtensions } = await import('./extensions/install')
installExtensions(kernel as any)
