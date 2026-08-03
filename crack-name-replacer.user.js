// ==UserScript==
// @name         크랙 캡처용 이름 치환
// @namespace    crack-name-replacer
// @version      1.0.0
// @description  크랙 화면에 표시되는 이름을 캡처용 가명으로 치환합니다.
// @match        https://crack.wrtn.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // 아래 이름 두 개만 원하는 대로 수정하세요.
    const REPLACEMENTS = [
        ['원래이름', '캡처용이름'],

        // 여러 이름을 바꾸려면 아래처럼 추가하세요.
        // ['원래닉네임', '가짜닉네임'],
    ];

    const STORAGE_KEY = 'crackNameReplacerEnabled';
    const SKIP_TAGS = new Set([
        'SCRIPT',
        'STYLE',
        'NOSCRIPT',
        'TEXTAREA',
        'INPUT',
        'SELECT',
        'OPTION',
        'CODE',
        'PRE'
    ]);

    let enabled = localStorage.getItem(STORAGE_KEY) !== 'disabled';

    function replaceText(text) {
        if (!enabled || typeof text !== 'string') {
            return text;
        }

        let result = text;
        const sortedRules = [...REPLACEMENTS].sort(
            (a, b) => b[0].length - a[0].length
        );

        for (const [originalName, replacementName] of sortedRules) {
            if (!originalName || originalName === replacementName) {
                continue;
            }

            result = result.split(originalName).join(replacementName);
        }

        return result;
    }

    function shouldSkipElement(element) {
        if (!(element instanceof Element)) {
            return false;
        }

        return SKIP_TAGS.has(element.tagName) || element.isContentEditable;
    }

    function processElementAttributes(element) {
        if (!(element instanceof Element) || shouldSkipElement(element)) {
            return;
        }

        for (const attribute of ['title', 'aria-label', 'alt', 'placeholder']) {
            if (!element.hasAttribute(attribute)) {
                continue;
            }

            const currentValue = element.getAttribute(attribute);
            const replacedValue = replaceText(currentValue);

            if (replacedValue !== currentValue) {
                element.setAttribute(attribute, replacedValue);
            }
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

        const replacedValue = replaceText(node.nodeValue);

        if (replacedValue !== node.nodeValue) {
            node.nodeValue = replacedValue;
        }
    }

    function processSubtree(root) {
        if (!enabled || !root) {
            return;
        }

        if (root instanceof Text) {
            processTextNode(root);
            return;
        }

        if (!(root instanceof Element) || shouldSkipElement(root)) {
            return;
        }

        processElementAttributes(root);

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
                processElementAttributes(node);
            }
        }
    }

    function startReplacement() {
        if (!enabled) {
            console.log('[크랙 이름 치환] 현재 꺼져 있음');
            return;
        }

        if (document.body) {
            processSubtree(document.body);
        }

        const observer = new MutationObserver((mutations) => {
            if (!enabled) {
                return;
            }

            for (const mutation of mutations) {
                if (mutation.type === 'characterData') {
                    processTextNode(mutation.target);
                }

                if (mutation.type === 'attributes') {
                    processElementAttributes(mutation.target);
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

        console.log('[크랙 이름 치환] 작동 중 · Alt + Shift + N으로 켜기/끄기');
    }

    document.addEventListener('keydown', (event) => {
        if (event.altKey && event.shiftKey && event.code === 'KeyN') {
            event.preventDefault();

            const nextEnabled = !enabled;
            localStorage.setItem(
                STORAGE_KEY,
                nextEnabled ? 'enabled' : 'disabled'
            );

            location.reload();
        }
    });

    startReplacement();
})();
