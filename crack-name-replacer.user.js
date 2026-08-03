// ==UserScript==
// @name         크랙 캡처용 이름 치환 토글 v2.2
// @namespace    crack-name-toggle
// @version      2.2.0
// @description  크랙 화면의 이름을 실시간 치환하고, 토글 UI를 자유롭게 이동합니다.
// @match        https://crack.wrtn.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const SETTINGS_KEY = 'crackNameToggleSettingsV22';
    const POSITIONS_KEY = 'crackNameTogglePositionsV22';

    const PANEL_ID = 'crack-name-toggle-panel';
    const BUTTON_ID = 'crack-name-toggle-button';
    const STYLE_ID = 'crack-name-toggle-style';

    // CODE와 PRE는 제외하지 않음: 코드 블록 안의 이름도 치환합니다.
    const SKIP_TAGS = new Set([
        'SCRIPT',
        'STYLE',
        'NOSCRIPT',
        'TEXTAREA',
        'INPUT',
        'SELECT',
        'OPTION'
    ]);

    const TRACKED_ATTRIBUTES = [
        'title',
        'aria-label',
        'alt',
        'placeholder'
    ];

    const originalTextNodes = new WeakMap();
    const originalAttributes = new WeakMap();

    let settings = loadSettings();
    let observer = null;
    let isApplying = false;
    let suppressButtonClick = false;

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

            return {
                enabled: Boolean(saved.enabled),
                originalName:
                    typeof saved.originalName === 'string'
                        ? saved.originalName
                        : '',
                replacementName:
                    typeof saved.replacementName === 'string'
                        ? saved.replacementName
                        : ''
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

    function loadPositions() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(POSITIONS_KEY) || '{}'
            );

            return {
                panel: isValidPosition(saved.panel) ? saved.panel : null,
                button: isValidPosition(saved.button) ? saved.button : null
            };
        } catch {
            return {
                panel: null,
                button: null
            };
        }
    }

    function savePositions(positions) {
        localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
    }

    function isValidPosition(position) {
        return Boolean(
            position &&
            Number.isFinite(position.left) &&
            Number.isFinite(position.top)
        );
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function isOwnUi(element) {
        return Boolean(
            element?.closest?.(`#${PANEL_ID}, #${BUTTON_ID}`)
        );
    }

    function shouldSkipElement(element) {
        if (!(element instanceof Element)) {
            return false;
        }

        return (
            SKIP_TAGS.has(element.tagName) ||
            element.isContentEditable ||
            isOwnUi(element)
        );
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
        if (!canReplace() || typeof value !== 'string') {
            return value;
        }

        return value
            .split(settings.originalName)
            .join(settings.replacementName);
    }

    function rememberTextNode(node) {
        if (!originalTextNodes.has(node)) {
            originalTextNodes.set(node, node.nodeValue);
        }
    }

    function rememberAttribute(element, attribute, value) {
        let attributeMap = originalAttributes.get(element);

        if (!attributeMap) {
            attributeMap = new Map();
            originalAttributes.set(element, attributeMap);
        }

        if (!attributeMap.has(attribute)) {
            attributeMap.set(attribute, value);
        }
    }

    function processTextNode(node) {
        if (!(node instanceof Text)) {
            return;
        }

        const parent = node.parentElement;

        if (!parent || shouldSkipElement(parent)) {
            return;
        }

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
        if (
            !(element instanceof Element) ||
            shouldSkipElement(element)
        ) {
            return;
        }

        for (const attribute of TRACKED_ATTRIBUTES) {
            if (!element.hasAttribute(attribute)) {
                continue;
            }

            const current = element.getAttribute(attribute);
            rememberAttribute(element, attribute, current);

            const original =
                originalAttributes.get(element).get(attribute);

            const nextValue = canReplace()
                ? replaceValue(original)
                : original;

            if (current !== nextValue) {
                element.setAttribute(attribute, nextValue);
            }
        }
    }

    function processSubtree(root) {
        if (!root) {
            return;
        }

        if (root instanceof Text) {
            processTextNode(root);
            return;
        }

        if (
            !(root instanceof Element) ||
            shouldSkipElement(root)
        ) {
            return;
        }

        processAttributes(root);

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (
                        node instanceof Element &&
                        shouldSkipElement(node)
                    ) {
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
        if (isApplying || !document.body) {
            return;
        }

        isApplying = true;

        try {
            processSubtree(document.body);
        } finally {
            isApplying = false;
        }
    }

    function setEnabled(enabled) {
        settings.enabled = Boolean(enabled);
        saveSettings();
        updateUi();
        applyToPage();
    }

    function saveNamesFromUi() {
        const originalInput = document.querySelector(
            '#crack-name-original-input'
        );

        const replacementInput = document.querySelector(
            '#crack-name-replacement-input'
        );

        settings.originalName =
            originalInput?.value.trim() || '';

        settings.replacementName =
            replacementInput?.value.trim() || '';

        saveSettings();
        updateUi();
        applyToPage();
    }

    function updateUi() {
        const checkbox = document.querySelector(
            '#crack-name-toggle-checkbox'
        );

        const status = document.querySelector(
            '#crack-name-toggle-status'
        );

        const button = document.getElementById(BUTTON_ID);

        if (checkbox) {
            checkbox.checked = settings.enabled;
        }

        if (button) {
            button.dataset.enabled =
                settings.enabled ? 'true' : 'false';

            button.textContent = settings.enabled
                ? '이름 치환 ON'
                : '이름 치환 OFF';
        }

        if (!status) {
            return;
        }

        if (
            !settings.originalName ||
            !settings.replacementName
        ) {
            status.textContent =
                '현재 이름과 캡처용 이름을 입력해줘.';
            return;
        }

        status.textContent = settings.enabled
            ? `${settings.originalName} → ${settings.replacementName}`
            : '현재 원래 이름으로 표시 중';
    }

    function createStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;

        style.textContent = `
            #${PANEL_ID} {
                position: fixed;
                right: 18px;
                bottom: 82px;
                width: 278px;
                padding: 0 14px 14px;
                border: 1px solid rgba(0, 0, 0, 0.10);
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.97);
                box-shadow: 0 10px 32px rgba(0, 0, 0, 0.18);
                color: #222;
                z-index: 2147483647;
                font-family:
                    Arial,
                    "Apple SD Gothic Neo",
                    "Noto Sans KR",
                    sans-serif;
                box-sizing: border-box;
            }

            #${PANEL_ID} * {
                box-sizing: border-box;
            }

            #${PANEL_ID}.cnt-hidden {
                display: none;
            }

            #${PANEL_ID} .cnt-drag-handle {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                height: 44px;
                cursor: grab;
                user-select: none;
                touch-action: none;
            }

            #${PANEL_ID} .cnt-drag-handle:active {
                cursor: grabbing;
            }

            #${PANEL_ID} .cnt-title {
                font-size: 15px;
                font-weight: 700;
            }

            #${PANEL_ID} .cnt-drag-guide {
                color: #aaa;
                font-size: 16px;
                letter-spacing: 1px;
            }

            #${PANEL_ID} .cnt-close {
                width: 28px;
                height: 28px;
                padding: 0;
                border: 0;
                border-radius: 8px;
                background: transparent;
                color: #666;
                cursor: pointer;
                font-size: 19px;
                line-height: 1;
            }

            #${PANEL_ID} .cnt-close:hover {
                background: rgba(0, 0, 0, 0.06);
            }

            #${PANEL_ID} .cnt-label {
                display: block;
                margin: 9px 0 5px;
                color: #666;
                font-size: 12px;
            }

            #${PANEL_ID} .cnt-input {
                width: 100%;
                height: 37px;
                padding: 0 10px;
                border: 1px solid #ddd;
                border-radius: 10px;
                outline: none;
                background: #fff;
                color: #222;
                font-size: 13px;
            }

            #${PANEL_ID} .cnt-input:focus {
                border-color: #d88fb3;
                box-shadow:
                    0 0 0 3px rgba(216, 143, 179, 0.14);
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
                height: 37px;
                border: 0;
                border-radius: 10px;
                background: #efb2cf;
                color: #4b2338;
                cursor: pointer;
                font-size: 13px;
                font-weight: 700;
            }

            #${PANEL_ID} .cnt-switch {
                position: relative;
                display: inline-block;
                flex: 0 0 auto;
                width: 48px;
                height: 28px;
            }

            #${PANEL_ID} .cnt-switch input {
                width: 0;
                height: 0;
                opacity: 0;
            }

            #${PANEL_ID} .cnt-slider {
                position: absolute;
                inset: 0;
                border-radius: 999px;
                background: #ccc;
                cursor: pointer;
                transition: 0.2s;
            }

            #${PANEL_ID} .cnt-slider::before {
                content: "";
                position: absolute;
                top: 3px;
                left: 3px;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: white;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
                transition: 0.2s;
            }

            #${PANEL_ID}
            .cnt-switch
            input:checked + .cnt-slider {
                background: #e59abc;
            }

            #${PANEL_ID}
            .cnt-switch
            input:checked + .cnt-slider::before {
                transform: translateX(20px);
            }

            #${PANEL_ID} .cnt-status {
                min-height: 16px;
                margin-top: 10px;
                color: #777;
                font-size: 11px;
                overflow-wrap: anywhere;
            }

            #${PANEL_ID} .cnt-help {
                margin-top: 7px;
                color: #999;
                font-size: 10px;
            }

            #${BUTTON_ID} {
                position: fixed;
                right: 18px;
                bottom: 24px;
                height: 42px;
                padding: 0 15px;
                border: 1px solid rgba(0, 0, 0, 0.10);
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.97);
                box-shadow: 0 7px 22px rgba(0, 0, 0, 0.16);
                color: #4b2338;
                z-index: 2147483647;
                cursor: move;
                user-select: none;
                touch-action: none;
                font-family:
                    Arial,
                    "Apple SD Gothic Neo",
                    "Noto Sans KR",
                    sans-serif;
                font-size: 13px;
                font-weight: 700;
            }

            #${BUTTON_ID}[data-enabled="true"] {
                background: #efb2cf;
            }
        `;

        document.head.appendChild(style);
    }

    function applySavedPosition(element, position) {
        if (!element || !position) {
            return;
        }

        const maxLeft = Math.max(
            0,
            window.innerWidth - element.offsetWidth
        );

        const maxTop = Math.max(
            0,
            window.innerHeight - element.offsetHeight
        );

        element.style.left =
            `${clamp(position.left, 0, maxLeft)}px`;

        element.style.top =
            `${clamp(position.top, 0, maxTop)}px`;

        element.style.right = 'auto';
        element.style.bottom = 'auto';
    }

    function saveElementPosition(element, name) {
        const rect = element.getBoundingClientRect();
        const positions = loadPositions();

        positions[name] = {
            left: Math.round(rect.left),
            top: Math.round(rect.top)
        };

        savePositions(positions);
    }

    function makeDraggable(
        element,
        handle,
        storageName,
        onDragEnd
    ) {
        if (!element || !handle) {
            return;
        }

        let dragging = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        let pointerId = null;

        function start(event) {
            if (
                event.target.closest(
                    'input, textarea, select, button, label'
                )
            ) {
                return;
            }

            const rect = element.getBoundingClientRect();

            dragging = true;
            moved = false;
            pointerId = event.pointerId;

            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;

            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.top}px`;
            element.style.right = 'auto';
            element.style.bottom = 'auto';

            handle.setPointerCapture?.(pointerId);
            event.preventDefault();
        }

        function move(event) {
            if (
                !dragging ||
                event.pointerId !== pointerId
            ) {
                return;
            }

            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            if (
                Math.abs(dx) > 3 ||
                Math.abs(dy) > 3
            ) {
                moved = true;
            }

            const maxLeft = Math.max(
                0,
                window.innerWidth - element.offsetWidth
            );

            const maxTop = Math.max(
                0,
                window.innerHeight - element.offsetHeight
            );

            element.style.left =
                `${clamp(startLeft + dx, 0, maxLeft)}px`;

            element.style.top =
                `${clamp(startTop + dy, 0, maxTop)}px`;
        }

        function end(event) {
            if (
                !dragging ||
                event.pointerId !== pointerId
            ) {
                return;
            }

            dragging = false;
            handle.releasePointerCapture?.(pointerId);

            if (moved) {
                saveElementPosition(element, storageName);
            }

            if (typeof onDragEnd === 'function') {
                onDragEnd(moved);
            }
        }

        handle.addEventListener('pointerdown', start);
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }

    function keepElementOnScreen(element) {
        if (!element) {
            return;
        }

        const rect = element.getBoundingClientRect();
        const maxLeft = Math.max(
            0,
            window.innerWidth - element.offsetWidth
        );

        const maxTop = Math.max(
            0,
            window.innerHeight - element.offsetHeight
        );

        element.style.left =
            `${clamp(rect.left, 0, maxLeft)}px`;

        element.style.top =
            `${clamp(rect.top, 0, maxTop)}px`;

        element.style.right = 'auto';
        element.style.bottom = 'auto';
    }

    function createUi() {
        if (
            !document.body ||
            document.getElementById(PANEL_ID)
        ) {
            return;
        }

        createStyles();

        const panel = document.createElement('div');
        panel.id = PANEL_ID;

        panel.innerHTML = `
            <div class="cnt-drag-handle">
                <div>
                    <span class="cnt-title">
                        캡처용 이름 치환
                    </span>
                    <span class="cnt-drag-guide">⋮⋮</span>
                </div>

                <button
                    class="cnt-close"
                    type="button"
                    title="설정창 닫기"
                >×</button>
            </div>

            <label
                class="cnt-label"
                for="crack-name-original-input"
            >
                현재 화면의 내 이름
            </label>

            <input
                id="crack-name-original-input"
                class="cnt-input"
                type="text"
                autocomplete="off"
                placeholder="예: 김고앵"
            >

            <label
                class="cnt-label"
                for="crack-name-replacement-input"
            >
                캡처에 보일 이름
            </label>

            <input
                id="crack-name-replacement-input"
                class="cnt-input"
                type="text"
                autocomplete="off"
                placeholder="예: 한서윤"
            >

            <div class="cnt-actions">
                <button
                    class="cnt-save"
                    type="button"
                >
                    이름 적용
                </button>

                <label
                    class="cnt-switch"
                    title="이름 치환 켜기/끄기"
                >
                    <input
                        id="crack-name-toggle-checkbox"
                        type="checkbox"
                    >
                    <span class="cnt-slider"></span>
                </label>
            </div>

            <div
                id="crack-name-toggle-status"
                class="cnt-status"
            ></div>

            <div class="cnt-help">
                위 제목 부분을 끌어 설정창 이동 ·
                아래 버튼도 끌어서 이동 가능
            </div>
        `;

        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.type = 'button';

        document.body.append(panel, button);

        const originalInput = panel.querySelector(
            '#crack-name-original-input'
        );

        const replacementInput = panel.querySelector(
            '#crack-name-replacement-input'
        );

        const saveButton = panel.querySelector('.cnt-save');
        const closeButton = panel.querySelector('.cnt-close');
        const checkbox = panel.querySelector(
            '#crack-name-toggle-checkbox'
        );

        const panelHandle = panel.querySelector(
            '.cnt-drag-handle'
        );

        originalInput.value = settings.originalName;
        replacementInput.value = settings.replacementName;

        saveButton.addEventListener(
            'click',
            saveNamesFromUi
        );

        checkbox.addEventListener('change', () => {
            if (
                checkbox.checked &&
                (
                    !originalInput.value.trim() ||
                    !replacementInput.value.trim()
                )
            ) {
                saveNamesFromUi();
            }

            setEnabled(checkbox.checked);
        });

        for (
            const input of [
                originalInput,
                replacementInput
            ]
        ) {
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    saveNamesFromUi();
                }
            });
        }

        closeButton.addEventListener('click', () => {
            panel.classList.add('cnt-hidden');
        });

        button.addEventListener('click', () => {
            if (suppressButtonClick) {
                suppressButtonClick = false;
                return;
            }

            panel.classList.toggle('cnt-hidden');
        });

        makeDraggable(
            panel,
            panelHandle,
            'panel'
        );

        makeDraggable(
            button,
            button,
            'button',
            moved => {
                if (moved) {
                    suppressButtonClick = true;

                    setTimeout(() => {
                        suppressButtonClick = false;
                    }, 200);
                }
            }
        );

        const positions = loadPositions();

        requestAnimationFrame(() => {
            applySavedPosition(
                panel,
                positions.panel
            );

            applySavedPosition(
                button,
                positions.button
            );
        });

        window.addEventListener('resize', () => {
            keepElementOnScreen(panel);
            keepElementOnScreen(button);

            saveElementPosition(panel, 'panel');
            saveElementPosition(button, 'button');
        });

        updateUi();
    }

    function startObserver() {
        observer?.disconnect();

        observer = new MutationObserver(mutations => {
            if (isApplying) {
                return;
            }

            for (const mutation of mutations) {
                if (mutation.type === 'characterData') {
                    const node = mutation.target;
                    const parent = node.parentElement;

                    if (
                        node instanceof Text &&
                        parent &&
                        !shouldSkipElement(parent)
                    ) {
                        const stored =
                            originalTextNodes.get(node);

                        // 사이트가 새 텍스트를 넣었을 때 원본 갱신
                        if (
                            stored === undefined ||
                            (
                                !canReplace() &&
                                node.nodeValue !== stored
                            )
                        ) {
                            originalTextNodes.set(
                                node,
                                node.nodeValue
                            );
                        }
                    }

                    processTextNode(node);
                }

                if (mutation.type === 'attributes') {
                    processAttributes(mutation.target);
                }

                for (
                    const addedNode of mutation.addedNodes
                ) {
                    processSubtree(addedNode);
                }
            }
        });

        observer.observe(
            document.documentElement,
            {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true,
                attributeFilter: TRACKED_ATTRIBUTES
            }
        );
    }

    function init() {
        createUi();
        applyToPage();
        startObserver();

        document.addEventListener('keydown', event => {
            if (
                event.altKey &&
                event.shiftKey &&
                event.code === 'KeyN' &&
                !isOwnUi(event.target)
            ) {
                event.preventDefault();
                setEnabled(!settings.enabled);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            init,
            { once: true }
        );
    } else {
        init();
    }
})();
