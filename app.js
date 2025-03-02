document.addEventListener('DOMContentLoaded', () => {
    // 配置marked选项，允许HTML内容
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false,
        sanitize: false  // 允许HTML内容
    });
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const loading = document.getElementById('loading');
    const configModal = document.getElementById('configModal');
    const configButton = document.getElementById('configButton');
    const closeButton = document.querySelector('.close');
    const apiKeyInput = document.getElementById('apiKey');
    const saveConfigButton = document.getElementById('saveConfig');

    // 默认配置
    let API_KEY = '';
    let MODEL = 'ep-20250221223009-6bgtt'; // 默认模型

    // 从本地存储加载配置
    function loadConfig() {
        const savedApiKey = localStorage.getItem('apiKey');
        const savedModel = localStorage.getItem('model');
        
        if (savedApiKey) {
            API_KEY = savedApiKey;
            apiKeyInput.value = savedApiKey;
        }
        
        if (savedModel) {
            MODEL = savedModel;
            document.getElementById('model').value = savedModel;
        }
        
        // 初始化API模块
        API.init(null, API_KEY, MODEL);
    }

    // 保存配置到本地存储
    function saveConfig() {
        const apiKey = apiKeyInput.value.trim();
        const model = document.getElementById('model').value.trim();
        
        if (apiKey && model) {
            localStorage.setItem('apiKey', apiKey);
            localStorage.setItem('model', model);
            API_KEY = apiKey;
            MODEL = model;
            // 更新API模块的配置
            API.init(null, API_KEY, MODEL);
            alert('配置已保存');
            configModal.style.display = 'none';
        } else {
            alert('请输入有效的API Key和Model');
        }
    }

    // 加载配置
    loadConfig();

    // 配置按钮事件
    configButton.addEventListener('click', () => {
        configModal.style.display = 'block';
    });

    // 关闭按钮事件
    closeButton.addEventListener('click', () => {
        configModal.style.display = 'none';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (event) => {
        if (event.target === configModal) {
            configModal.style.display = 'none';
        }
    });

    // 保存配置按钮事件
    saveConfigButton.addEventListener('click', saveConfig);

    let controller = null;

    // 添加消息到聊天界面
    function addMessage(content, isUser = false, isReasoning = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'assistant'} ${isReasoning ? 'reasoning' : ''}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (isUser) {
            messageContent.textContent = content;
            
            // 为用户消息添加tokens计数
            const statsDiv = document.createElement('div');
            statsDiv.className = 'stats';
            const tokensSpan = document.createElement('span');
            tokensSpan.className = 'tokens';
            // 更准确地估算tokens数量：中文每个字约1.5个token，英文和标点每个字符约0.25个token
            const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
            const otherChars = content.length - chineseChars;
            const tokenEstimate = Math.ceil(chineseChars * 1.5 + otherChars * 0.25);
            tokensSpan.textContent = `${tokenEstimate} tokens`;
            statsDiv.appendChild(tokensSpan);
            messageDiv.appendChild(statsDiv);
        } else {
            messageContent.innerHTML = marked.parse(content);
        }
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    let messageHistory = [];

    // 处理用户输入
    async function handleUserInput() {
        const message = userInput.value.trim();
        if (!message) return;
    
        try {
            // 禁用输入和按钮
            userInput.value = '';
            userInput.disabled = true;
            sendButton.disabled = true;
            loading.classList.add('active');
    
            // 显示用户消息
            addMessage(message, true);
            messageHistory.push({ role: 'user', content: message });
    
            // 创建新的响应消息容器
            const responseDiv = document.createElement('div');
            responseDiv.className = 'message assistant';
            const responseContent = document.createElement('div');
            responseContent.className = 'message-content';
            responseDiv.appendChild(responseContent);
            chatMessages.appendChild(responseDiv);

            // 创建思考过程容器
            const reasoningDiv = document.createElement('div');
            reasoningDiv.className = 'message assistant reasoning';
            
            // 添加统计信息容器
            const statsDiv = document.createElement('div');
            statsDiv.className = 'stats';
            const timeSpan = document.createElement('span');
            timeSpan.className = 'time';
            timeSpan.textContent = '0秒';
            const tokensSpan = document.createElement('span');
            tokensSpan.className = 'tokens';
            tokensSpan.textContent = '0 tokens';
            statsDiv.appendChild(timeSpan);
            statsDiv.appendChild(tokensSpan);
            reasoningDiv.appendChild(statsDiv);
            
            // 添加折叠按钮
            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-button';
            toggleButton.textContent = '收起';
            toggleButton.onclick = () => {
                const isCollapsed = reasoningContent.style.display === 'none';
                reasoningContent.style.display = isCollapsed ? 'block' : 'none';
                toggleButton.textContent = isCollapsed ? '收起' : '展开';
            };
            reasoningDiv.appendChild(toggleButton);
            
            const reasoningContent = document.createElement('div');
            reasoningContent.className = 'message-content';
            reasoningDiv.appendChild(reasoningContent);
            
            chatMessages.insertBefore(reasoningDiv, responseDiv);
            let accumulatedReasoning = '';
            
            // 计时器
            const startTime = Date.now();
            const updateTimer = setInterval(() => {
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                timeSpan.textContent = `${elapsedSeconds}秒`;
            }, 1000);
            
            let tokenCount = 0;
    
            // 取消之前的请求（如果存在）
            if (controller) {
                controller.abort();
            }
            controller = new AbortController();
    
            const response = await API.sendMessage(messageHistory);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedResponse = '';
    
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
    
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.trim() === '') continue;
                    // console.log('Received line:', line);
                    try {
                        // 去掉每行开头的'data: '前缀
                        const cleanedLine = line.replace(/^data:\s*/, '');
                        const jsonResponse = JSON.parse(cleanedLine);
                        const content = jsonResponse.choices[0].delta.content || '';
                        const reasoning = jsonResponse.choices[0].delta.reasoning_content || '';
                        // 更新token计数
                        if (jsonResponse.usage && jsonResponse.usage.total_tokens) {
                            tokenCount = jsonResponse.usage.total_tokens;
                            tokensSpan.textContent = `${tokenCount} tokens`;
                        }
                        if (reasoning) {
                            accumulatedReasoning += reasoning;
                            reasoningContent.innerHTML = marked.parse(accumulatedReasoning);
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                        if (content) {
                            accumulatedResponse += content;
                            responseContent.innerHTML = marked.parse(accumulatedResponse);
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    } catch (e) {
                        // console.log('JSON解析错误:', e);
                        continue;
                    }
                }
            }

            // 清理计时器
            clearInterval(updateTimer);

            // 如果没有思考过程，移除思考过程容器
            if (!accumulatedReasoning) {
                reasoningDiv.remove();
            } else {
                // 计算思考过程和结论的总tokens
                const combinedContent = accumulatedReasoning + accumulatedResponse;
                const chineseChars = (combinedContent.match(/[\u4e00-\u9fa5]/g) || []).length;
                const otherChars = combinedContent.length - chineseChars;
                const totalTokens = Math.ceil(chineseChars * 1.5 + otherChars * 0.25);
                tokensSpan.textContent = `${totalTokens} tokens`;
            }
    
            // 将AI回复添加到历史记录
            messageHistory.push({ role: 'assistant', content: accumulatedResponse });
    
        } catch (error) {
            console.error('Error:', error);
            // 修复：使用已创建的responseContent变量或创建一个新的错误消息
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message assistant';
            const errorContent = document.createElement('div');
            errorContent.className = 'message-content';
            errorContent.textContent = `抱歉，发生了错误：${error.message}`;
            errorDiv.appendChild(errorContent);
            chatMessages.appendChild(errorDiv);
        } finally {
            // 重置状态
            userInput.disabled = false;
            sendButton.disabled = false;
            loading.classList.remove('active');
            controller = null;
        }
    }

    // 事件监听器
    sendButton.addEventListener('click', handleUserInput);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserInput();
        }
    });
});