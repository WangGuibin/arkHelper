// API模块用于处理与火山引擎的通信
const API = {
    // 根据当前环境动态获取API URL
    get API_URL() {
        // 如果是GitHub Pages环境，使用公共API代理服务器
        if (window.location.hostname.includes('github.io')) {
            return 'https://api-proxy.yourdomain.com/api/v3/chat/completions';
        }
        // 本地开发环境使用本地代理服务器
        return 'http://localhost:3000/api/v3/chat/completions';
    },
    API_KEY: '',
    MODEL: '',

    init(apiUrl, apiKey, model) {
        // 保持固定的 API URL
        this.API_KEY = apiKey;
        if (model) {
            this.MODEL = model;
        }
    },

    async sendMessage(messages) {
        if (!this.API_KEY) {
            throw new Error('请先配置API Key');
        }

        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: this.MODEL,
                    messages: messages,
                    stream: true
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
            }

            return response;
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(`请求失败: ${error.message}`);
        }
    }
};

// 导出API对象供其他模块使用
window.API = API;