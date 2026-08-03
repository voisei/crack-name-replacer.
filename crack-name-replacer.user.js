// ==UserScript==
// @name         크랙 캡처용 이름 치환 토글
// @namespace    crack-name-toggle
// @version      2.0.0
// @description  크랙 채팅 중 화면에서 이름 치환을 바로 켜고 끕니다.
// @match        https://crack.wrtn.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const SETTINGS_KEY = 'crackNameToggleSettingsV2';
    const PANEL_ID = 'crack-name-toggle-panel';
    const BUTTON_ID = 'crack-name-toggle-mini-button';

    const SKIP_TAGS = new Set([
        'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT',
        'SELECT', 'OPTION', 'CODE', 'PRE'
    ]);

    const originalTextNodes = new WeakMap();
    const originalAttributes = new WeakMap();

    let settings = loadSettings();
    let observer = null;
    let isApplying = false;

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            return {
                enabled: Boolean(saved.enabled),
                originalName: typeof saved.originalName === 'string' ? saved.originalName : '',
                replacementName: typeof saved.replacementName === 'string' ? saved.replacementName : ''
            };
        } catch {
            return {
                enabled: false,
                originalName: '',
                replacementName: ''
            };
        }
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function isUiElement(element) {
        return Boolean(
            element?.closest?.(`#${PANEL_ID}, #${BUTTON_ID}`)
        );
    }

    function shouldSkipElement(element) {
        if (!(element instanceof Element)) return false;
        return SKIP_TAGS.has(element.tagName) ||
            element.isContentEditable ||
            isUiElement(element);
    }

    function canReplace() {
        return Boolean(
            settings.enabled &&
            settings.originalName &&
            settings.replacementName &&
            settings.originalName !== settings.replacementName
        );
    }

    function replaceValue(value) {
        if (!canReplace() || typeof value !== 'string') return value;
        return value.split(settings.originalName).join(settings.replacementName);
    }

    function rememberTextNode(node) {
        if (!originalTextNodes.has(node)) {
            originalTextNodes.set(node, node.nodeValue);
        }
    }

    function rememberAttribute(element, attribute, value) {
        let map = originalAttributes.get(element);
        if (!map) {
            map = new Map();
            originalAttributes.set(element, map);
        }

        if (!map.has(attribute)) {
            map.set(attribute, value);
        }
    }

    function processTextNode(node) {
        if (!(node instanceof Text)) return;

        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent)) return;

        rememberTextNode(node);
        const original = originalTextNodes.get(node);

        const nextValue = canReplace()
            ? replaceValue(original)
            : original;

        if (node.nodeValue !== nextValue) {
            node.nodeValue = nextValue;
        }
    }

    function processAttributes(element) {
        if (!(element instanceof Element) || shouldSkipElement(element)) return;

        const attributes = ['title', 'aria-label', 'alt', 'placeholder'];

        for (const attribute of attributes) {
            if (!element.hasAttribute(attribute)) continue;

            const current = element.getAttribute(attribute);
            rememberAttribute(element, attribute, current);

            const original = originalAttributes.get(element).get(attribute);
            const nextValue = canReplace()
                ? replaceValue(original)
                : original;

            if (current !== nextValue) {
                element.setAttribute(attribute, nextValue);
            }
        }
    }

    function processSubtree(root) {
        if (!root) return;

        if (root instanceof Text) {
            processTextNode(root);
            return;
        }

        if (!(root instanceof Element) || shouldSkipElement(root)) return;

        processAttributes(root);

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (node instanceof Element && shouldSkipElement(node)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        while ((node = walker.nextNode())) {
            if (node instanceof Text) {
                processTextNode(node);
            } else if (node instanceof Element) {
                processAttributes(node);
            }
        }
    }

    function applyToPage() {
        if (isApplying || !document.body) return;

        isApplying = true;
        try {
            processSubtree(document.body);
        } finally {
            isApplying = false;
        }
    }

    function updateToggleUi() {
        const toggle = document.querySelector('#crack-name-toggle-checkbox');
        const status = document.querySelector('#crack-name-toggle-status');

        if (toggle) toggle.checked = settings.enabled;

        if (status) {
            if (!settings.originalName || !settings.replacementName) {
                status.textContent = '이름을 입력해줘';
            } else {
                status.textContent = settings.enabled
                    ? `${settings.originalName} → ${settings.replacementName}`
                    : '현재 원래 이름 표시 중';
            }
        }
    }

    function setEnabled(enabled) {
        settings.enabled = Boolean(enabled);
        saveSettings();
        updateToggleUi();
        applyToPage();
    }

    function saveNames() {
        const originalInput = document.querySelector('#crack-name-original-input');
        const replacementInput = document.querySelector('#crack-name-replacement-input');

        settings.originalName = originalInput?.value.trim() || '';
        settings.replacementName = replacementInput?.value.trim() || '';

        saveSettings();
        updateToggleUi();
        applyToPage();
    }

    function createStyles() {
        if (document.querySelector('#crack-name-toggle-style')) return;

        const style = document.createElement('style');
        style.id = 'crack-name-toggle-style';
        style.textContent = `
            #${PANEL_ID} {
                position: fixed;
                right: 18px;
                bottom: 82px;
                width: 270px;
                padding: 14px;
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.97);
                border: 1px solid rgba(0, 0, 0, 0.10);
                box-shadow: 0 10px 32px rgba(0, 0, 0, 0.18);
                z-index: 2147483647;
                color: #222;
                font-family: Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
                box-sizing: border-box;
            }

            #${PANEL_ID} * {
                box-sizing: border-box;
            }

            #${PANEL_ID}.hidden {
                display: none;
            }

            #${PANEL_ID} .cnt-title-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                margin-bottom: 12px;
            }

            #${PANEL_ID} .cnt-title {
                font-size: 15px;
                font-weight: 700;
            }

            #${PANEL_ID} .cnt-close {
                border: 0;
                background: transparent;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                padding: 2px 4px;
                color: #666;
            }

            #${PANEL_ID} .cnt-label {
                display: block;
                margin: 9px 0 5px;
                font-size: 12px;
                color: #666;
            }

            #${PANEL_ID} .cnt-input {
                width: 100%;
                height: 36px;
                border: 1px solid #ddd;
                border-radius: 10px;
                padding: 0 10px;
                font-size: 13px;
                outline: none;
                background: #fff;
                color: #222;
            }

            #${PANEL_ID} .cnt-input:focus {
                border-color: #d88fb3;
                box-shadow: 0 0 0 3px rgba(216, 143, 179, 0.14);
            }

            #${PANEL_ID} .cnt-actions {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-top: 12px;
            }

            #${PANEL_ID} .cnt-save {
                flex: 1;
                height: 36px;
                border: 0;
                border-radius: 10px;
                background: #efb2cf;
                color: #4b2338;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
            }

            #${PANEL_ID} .cnt-switch {
                position: relative;
                display: inline-block;
                width: 48px;
                height: 28px;
                flex: 0 0 auto;
            }

            #${PANEL_ID} .cnt-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            #${PANEL_ID} .cnt-slider {
                position: absolute;
                inset: 0;
                cursor: pointer;
                background: #ccc;
                border-radius: 999px;
                transition: .2s;
            }

            #${PANEL_ID} .cnt-slider::before {
                content: "";
                position: absolute;
                width: 22px;
                height: 22px;
                left: 3px;
                top: 3px;
                background: white;
                border-radius: 50%;
                transition: .2s;
                box-shadow: 0 1px 4px rgba(0,0,0,.25);
            }

            #${PANEL_ID} .cnt-switch input:checked + .cnt-slider {
                background: #e59abc;
            }

            #${PANEL_ID} .cnt-switch input:checked + .cnt-slider::before {
                transform: translateX(20px);
            }

            #${PANEL_ID} .cnt-status {
                margin-top: 10px;
                min-height: 16px;
                font-size: 11px;
                color: #777;
                overflow-wrap: anywhere;
            }

            #${BUTTON_ID} {
                position: fixed;
                right: 18px;
                bottom: 24px;
                z-index: 2147483647;
                height: 42px;
                padding: 0 15px;
                border: 1px solid rgba(0, 0, 0, 0.10);
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.97);
                box-shadow: 0 7px 22px rgba(0, 0, 0, 0.16);
                color: #4b2338;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                font-family: Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
            }
        `;
        document.head.appendChild(style);
    }

    function createUi() {
        if (!document.body || document.getElementById(PANEL_ID)) return;

        createStyles();

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="cnt-title-row">
                <div class="cnt-title">캡처용 이름 치환</div>
                <button class="cnt-close" type="button" title="닫기">×</button>
            </div>

            <label class="cnt-label" for="crack-name-original-input">현재 화면의 내 이름</label>
            <input
                id="crack-name-original-input"
                class="cnt-input"
                type="text"
                autocomplete="off"
                placeholder="예: 김고앵"
                value=""
            >

            <label class="cnt-label" for="crack-name-replacement-input">캡처에 보일 이름</label>
            <input
                id="crack-name-replacement-input"
                class="cnt-input"
                type="text"
                autocomplete="off"
                placeholder="예: 한서윤"
                value=""
            >

            <div class="cnt-actions">
                <button class="cnt-save" type="button">이름 적용</button>

                <label class="cnt-switch" title="이름 치환 켜기/끄기">
                    <input id="crack-name-toggle-checkbox" type="checkbox">
                    <span class="cnt-slider"></span>
                </label>
            </div>

            <div id="crack-name-toggle-status" class="cnt-status"></div>
        `;

        const miniButton = document.createElement('button');
        miniButton.id = BUTTON_ID;
        miniButton.type = 'button';
        miniButton.textContent = '이름 토글';

        document.body.appendChild(panel);
        document.body.appendChild(miniButton);

        const originalInput = panel.querySelector('#crack-name-original-input');
        const replacementInput = panel.querySelector('#crack-name-replacement-input');
        const saveButton = panel.querySelector('.cnt-save');
        const closeButton = panel.querySelector('.cnt-close');
        const toggle = panel.querySelector('#crack-name-toggle-checkbox');

        originalInput.value = settings.originalName;
        replacementInput.value = settings.replacementName;

        saveButton.addEventListener('click', saveNames);

        toggle.addEventListener('change', () => {
            if (toggle.checked && (!originalInput.value.trim() || !replacementInput.value.trim())) {
                saveNames();
            }
            setEnabled(toggle.checked);
        });

        for (const input of [originalInput, replacementInput]) {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    saveNames();
                }
            });
        }

        closeButton.addEventListener('click', () => {
            panel.classList.add('hidden');
        });

        miniButton.addEventListener('click', () => {
            panel.classList.toggle('hidden');
        });

        updateToggleUi();
    }

    function startObserver() {
        if (observer) observer.disconnect();

        observer = new MutationObserver((mutations) => {
            if (isApplying) return;

            for (const mutation of mutations) {
                if (mutation.type === 'characterData') {
                    const node = mutation.target;

                    // 사이트가 텍스트를 새로 갱신한 경우 새 값을 원본으로 저장
                    if (node instanceof Text && !isUiElement(node.parentElement)) {
                        const current = node.nodeValue;
                        const stored = originalTextNodes.get(node);

                        if (
                            stored === undefined ||
                            (!canReplace() && current !== stored)
                        ) {
                            originalTextNodes.set(node, current);
                        }
                    }

                    processTextNode(node);
                }

                if (mutation.type === 'attributes') {
                    processAttributes(mutation.target);
                }

                for (const addedNode of mutation.addedNodes) {
                    processSubtree(addedNode);
                }
            }
        });

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['title', 'aria-label', 'alt', 'placeholder']
        });
    }

    function init() {
        createUi();
        applyToPage();
        startObserver();

        // 단축키: Alt + Shift + N
        document.addEventListener('keydown', (event) => {
            if (
                event.altKey &&
                event.shiftKey &&
                event.code === 'KeyN' &&
                !isUiElement(event.target)
            ) {
                event.preventDefault();
                setEnabled(!settings.enabled);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
