import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../styles/index.css'

// 创建 React 根节点并挂载到 HTML 的 #root 元素上
// 这是 React 18 的新 API
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
