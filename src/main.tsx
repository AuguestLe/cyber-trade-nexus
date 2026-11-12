import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { useAuthStore } from './store/authStore';
import { useConfigStore } from './store/configStore';
import './styles/tokens.css';

// 渲染前恢复会话与界面偏好，避免守卫误判跳登录
useAuthStore.getState().hydrate();
useConfigStore.getState().hydrate();

const container = document.getElementById('root');
if (!container) throw new Error('root container missing');

container.innerHTML = '';
createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
