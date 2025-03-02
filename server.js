const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// 启用CORS
app.use(cors());

// 静态文件服务
app.use(express.static('./'));

// 代理API请求
app.use('/api', createProxyMiddleware({
  target: 'https://ark.cn-beijing.volces.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  },
  onProxyRes: function(proxyRes, req, res) {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`);
});