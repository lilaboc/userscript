// ==UserScript==
// @name         MakerWorld 暴力算钱 - 3D打印成本估算
// @namespace    https://makerworld.com
// @version      2.0.0
// @description  在 MakerWorld 模型页面自动计算 3D 打印成本
// @author       You
// @match        https://makerworld.com/*
// @match        https://www.makerworld.com/*
// @match        https://makerworld.com.cn/*
// @match        https://www.makerworld.com.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ============ 材料价格 (CNY/kg) ============
    // 价格参考淘宝实际售价，可根据实际购买价格调整
    const MATERIALS = {
        'pla':       { name: 'PLA',       price: 65 },    // 淘宝约 ¥50-80/kg
        'pla+':      { name: 'PLA+',      price: 85 },    // 淘宝约 ¥70-100/kg
        'petg':      { name: 'PETG',      price: 75 },    // 淘宝约 ¥60-90/kg
        'abs':       { name: 'ABS',       price: 70 },    // 淘宝约 ¥55-85/kg
        'asa':       { name: 'ASA',       price: 90 },    // 淘宝约 ¥75-110/kg
        'tpu':       { name: 'TPU',       price: 120 },   // 淘宝约 ¥100-150/kg
        'nylon':     { name: 'Nylon',     price: 150 },   // 淘宝约 ¥120-180/kg
        'pc':        { name: 'PC',        price: 130 },   // 淘宝约 ¥100-160/kg
        'pva':       { name: 'PVA',       price: 200 },   // 淘宝约 ¥180-250/kg
        'pla-cf':    { name: 'PLA-CF',    price: 120 },   // 淘宝约 ¥100-150/kg
        'petg-cf':   { name: 'PETG-CF',   price: 130 },   // 淘宝约 ¥110-160/kg
        'nylon-cf':  { name: 'Nylon-CF',  price: 200 },   // 淘宝约 ¥180-250/kg
    };

    // ============ 配置 ============
    const CONFIG = {
        electricityRate: 0.6,  // ¥/kWh
        printerPower: 0.3,     // kW
        wearRate: 1.0,         // ¥/小时
    };

    // ============ 样式 ============
    const STYLES = `
        #vm-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 300px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
            padding: 16px;
        }
        #vm-panel h3 {
            margin: 0 0 12px 0;
            font-size: 16px;
            text-align: center;
        }
        #vm-panel label {
            display: block;
            font-size: 12px;
            opacity: 0.8;
            margin: 8px 0 4px 0;
        }
        #vm-panel input, #vm-panel select {
            width: 100%;
            padding: 8px;
            border: none;
            border-radius: 6px;
            background: rgba(255,255,255,0.15);
            color: #fff;
            font-size: 13px;
            box-sizing: border-box;
        }
        #vm-panel select option {
            background: #333;
            color: #fff;
        }
        #vm-panel button {
            width: 100%;
            padding: 10px;
            margin-top: 12px;
            border: none;
            border-radius: 6px;
            background: rgba(255,255,255,0.2);
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
        }
        #vm-panel button:hover {
            background: rgba(255,255,255,0.3);
        }
        #vm-result {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid rgba(255,255,255,0.2);
            display: none;
        }
        #vm-result .row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 6px;
        }
        #vm-result .total {
            font-size: 18px;
            font-weight: 700;
            text-align: center;
            margin-top: 8px;
        }
        #vm-result .total span {
            color: #ffd700;
            font-size: 22px;
        }
        #vm-status {
            font-size: 11px;
            text-align: center;
            margin-top: 8px;
            opacity: 0.7;
        }
        #vm-tip {
            font-size: 11px;
            opacity: 0.6;
            margin-top: 4px;
        }
    `;

    // ============ 成本计算 ============
    function calcCost(weightG, materialKey, timeMin, qty, profit) {
        const mat = MATERIALS[materialKey] || MATERIALS['pla'];
        const timeH = timeMin ? timeMin / 60 : weightG / 200;

        const filament = (weightG / 1000) * mat.price;
        const electricity = timeH * CONFIG.printerPower * CONFIG.electricityRate;
        const wear = timeH * CONFIG.wearRate;
        const unit = filament + electricity + wear;
        const price = unit * (1 + profit / 100);

        return {
            material: mat.name,
            weight: weightG,
            timeH: Math.round(timeH * 10) / 10,
            filament: Math.round(filament * 100) / 100,
            electricity: Math.round(electricity * 100) / 100,
            wear: Math.round(wear * 100) / 100,
            unit: Math.round(unit * 100) / 100,
            price: Math.round(price * 100) / 100,
            total: Math.round(price * qty * 100) / 100,
        };
    }

    // ============ 创建面板 ============
    function createPanel() {
        // 添加样式
        const style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);

        // 创建面板
        const panel = document.createElement('div');
        panel.id = 'vm-panel';
        panel.innerHTML = `
            <h3>💰 暴力算钱</h3>

            <label>耗材重量 (克)</label>
            <input type="number" id="vm-weight" placeholder="输入重量" step="0.1">
            <div id="vm-tip">在页面下方"打印配置"中查看</div>

            <label>材料类型</label>
            <select id="vm-material">
                ${Object.entries(MATERIALS).map(([k, v]) =>
                    `<option value="${k}">${v.name} (¥${v.price}/kg)</option>`
                ).join('')}
            </select>

            <label>打印时间 (分钟，可选)</label>
            <input type="number" id="vm-time" placeholder="自动估算">

            <label>数量</label>
            <input type="number" id="vm-qty" value="1" min="1">

            <label>利润率 (%)</label>
            <input type="number" id="vm-profit" value="0" min="0">


            <div id="vm-result">
                <div class="row"><span>材料</span><span id="r-mat"></span></div>
                <div class="row"><span>重量</span><span id="r-weight"></span></div>
                <div class="row"><span>时间</span><span id="r-time"></span></div>
                <div class="row"><span>耗材</span><span id="r-fil"></span></div>
                <div class="row"><span>电费</span><span id="r-ele"></span></div>
                <div class="row"><span>损耗</span><span id="r-wear"></span></div>
                <div class="total">单件成本 <span id="r-unit"></span></div>
                <div class="row" id="r-batch" style="display:none">
                    <span>批量总价</span><span id="r-total"></span>
                </div>
            </div>

            <div id="vm-status"></div>
        `;

        document.body.appendChild(panel);

        // 绑定事件（暂无）

        // 监听所有点击（更可靠）
        document.addEventListener('click', (e) => {
            // 排除脚本面板自身的点击
            if (e.target.closest('#vm-panel')) {
                return;
            }

            // 延迟检测，等待页面更新
            setTimeout(() => {
                autoDetect();
            }, 500);
        });
    }

    // ============ 自动检测 ============
    let instances = []; // 存储所有打印配置

    function autoDetect() {
        // 从 __NEXT_DATA__ JSON 中提取数据
        const nextDataScript = document.getElementById('__NEXT_DATA__');
        if (nextDataScript) {
            try {
                const data = JSON.parse(nextDataScript.textContent);
                instances = data?.props?.pageProps?.design?.instances || [];

                if (instances.length > 0) {
                    // 查找当前选中的配置
                    const selectedInstance = findSelectedInstance();

                    if (selectedInstance) {
                        updateWithData(selectedInstance);
                        return;
                    }
                }
            } catch (e) {
                // 静默处理错误
            }
        }

        // 备用方案：从页面文本提取
        const allText = document.body.innerText;

        const weightMatch = allText.match(/(\d+\.?\d*)\s*g(?:\s|$|,|\.|;)/);
        if (weightMatch) {
            const w = parseFloat(weightMatch[1]);
            if (w >= 10 && w <= 5000) {
                document.getElementById('vm-weight').value = w;
            }
        }

        const timeMatch = allText.match(/(\d+\.?\d*)\s*(?:小时|h)/i);
        if (timeMatch) {
            const timeMin = Math.round(parseFloat(timeMatch[1]) * 60);
            document.getElementById('vm-time').value = timeMin;
        }

        updateStatus(!!document.getElementById('vm-weight').value);
    }

    // 查找当前选中的配置
    function findSelectedInstance() {
        // 方法 1: 使用 URL 中的 profileId（最可靠）
        // 支持两种格式: #profileId=123 和 #profileId-123
        const urlMatch = window.location.href.match(/profileId[=-](\d+)/);
        if (urlMatch) {
            const profileId = urlMatch[1];
            for (const instance of instances) {
                if (instance.profileId == profileId || instance.id == profileId) {
                    console.log('[暴力算钱] ✅ 匹配到配置:', instance.title);
                    return instance;
                }
            }
        }

        // 方法 2: 查找有选中状态的元素
        const selectors = [
            '[class*="active"]',
            '[class*="selected"]',
            '[aria-selected="true"]',
            '[data-active="true"]',
            '[class*="current"]',
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent;
                // 检查是否包含配置相关的关键字（排除页面标题等）
                if ((text.includes('层高') || text.includes('填充') || text.includes('壁厚')) &&
                    !text.includes('免费') && !text.includes('打印模型') && !text.includes('MakerWorld')) {
                    // 在 instances 中查找匹配的配置
                    for (const instance of instances) {
                        if (instance.title && text.includes(instance.title.substring(0, 15))) {
                            console.log('[暴力算钱] ✅ 匹配到配置:', instance.title);
                            return instance;
                        }
                    }
                }
            }
        }

        // 方法 3: 查找所有配置元素，检查哪个有特殊的样式
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            const style = window.getComputedStyle(el);
            const text = el.textContent;

            // 检查是否有选中状态的样式（排除页面标题等）
            if (text.includes('层高') && text.includes('填充') &&
                !text.includes('免费') && !text.includes('打印模型') && !text.includes('MakerWorld') &&
                (style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                 style.borderColor !== 'rgb(204, 204, 204)' ||
                 style.fontWeight === 'bold' ||
                 style.fontWeight >= 600)) {

                for (const instance of instances) {
                    if (instance.title && text.includes(instance.title.substring(0, 15))) {
                        console.log('[暴力算钱] ✅ 匹配到配置:', instance.title);
                        return instance;
                    }
                }
            }
        }

        // 如果都没找到，使用第一个
        console.log('[暴力算钱] 使用第一个配置');
        return instances[0];
    }

    // 使用数据更新 UI
    function updateWithData(instance) {
        const weight = instance.weight;
        const printTime = instance.extention?.modelInfo?.plates?.[0]?.prediction;

        if (weight) {
            document.getElementById('vm-weight').value = weight;
        }

        if (printTime) {
            const timeMin = Math.round(printTime / 60);
            document.getElementById('vm-time').value = timeMin;
        }

        updateStatus(!!weight);

        // 自动计算
        if (weight) {
            calculate();
        }
    }

    // 更新状态显示
    function updateStatus(found) {
        const status = document.getElementById('vm-status');
        if (found) {
            status.textContent = '✓ 已自动检测到数据';
            status.style.color = '#4ade80';
        } else {
            status.textContent = '⚠ 未检测到数据，请手动输入';
            status.style.color = '#f87171';
        }
    }

    // ============ 计算 ============
    function calculate() {
        const weight = parseFloat(document.getElementById('vm-weight').value);
        if (!weight || weight <= 0) {
            document.getElementById('vm-status').textContent = '⚠ 请输入重量';
            return;
        }

        const material = document.getElementById('vm-material').value;
        const time = parseFloat(document.getElementById('vm-time').value) || null;
        const qty = parseInt(document.getElementById('vm-qty').value) || 1;
        const profit = parseFloat(document.getElementById('vm-profit').value) || 0;

        const r = calcCost(weight, material, time, qty, profit);

        document.getElementById('r-mat').textContent = r.material;
        document.getElementById('r-weight').textContent = r.weight + 'g';
        document.getElementById('r-time').textContent = r.timeH + '小时';
        document.getElementById('r-fil').textContent = '¥' + r.filament;
        document.getElementById('r-ele').textContent = '¥' + r.electricity;
        document.getElementById('r-wear').textContent = '¥' + r.wear;
        document.getElementById('r-unit').textContent = '¥' + r.price;

        const batchRow = document.getElementById('r-batch');
        if (qty > 1) {
            batchRow.style.display = 'flex';
            document.getElementById('r-total').textContent = '¥' + r.total;
        } else {
            batchRow.style.display = 'none';
        }

        document.getElementById('vm-result').style.display = 'block';
        document.getElementById('vm-status').textContent = '✓ 计算完成';
    }

    // ============ 初始化 ============
    if (document.readyState === 'complete') {
        createPanel();
        autoDetect();
    } else {
        window.addEventListener('load', () => {
            setTimeout(() => {
                createPanel();
                autoDetect();
            }, 1000);
        });
    }

    // 添加全局调试函数
    window.violentMoney = {
        detect: autoDetect,
        calc: calculate,
        test: function() {
            console.log('=== 暴力算钱调试 ===');
            console.log('面板存在:', !!document.getElementById('vm-panel'));
            console.log('重量输入:', document.getElementById('vm-weight')?.value);
            console.log('材料选择:', document.getElementById('vm-material')?.value);
            console.log('时间输入:', document.getElementById('vm-time')?.value);
            console.log('页面文本长度:', document.body.innerText.length);
            console.log('==================');
        }
    };

    console.log('[暴力算钱] 调试函数已注册: violentMoney.test() / violentMoney.detect()');
})();
