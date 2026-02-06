import Papa from "papaparse";

const KEYWORD_SOURCES = Object.freeze({
    tag: {
        url: "https://gist.githubusercontent.com/fpgaminer/0243de0d232a90dcae5e2f47d844f9bb/raw",
        column: "tag",
    },
    caption: {
        url: "https://gist.githubusercontent.com/fpgaminer/26f4da885cc61bede13b3779b81ba300/raw",
        column: "text",
    },
});

const KEYWORD_MAX_RESULTS = 30;
const keywordCache = {};
const keywordLoading = {};

export default {
    data() {
        return {
            keywordSearchQuery: {
                tag: "",
                caption: "",
            },
            keywordSearchResults: {
                tag: [],
                caption: [],
            },
            keywordSearchLoading: {
                tag: false,
                caption: false,
            },
            keywordSearchError: {
                tag: "",
                caption: "",
            },
            keywordSearchOpen: {
                tag: false,
                caption: false,
            },
        };
    },
    created() {
        this.keywordSearchTimers = {};
    },
    beforeUnmount() {
        if (!this.keywordSearchTimers) return;
        Object.values(this.keywordSearchTimers).forEach((timer) => {
            if (timer) clearTimeout(timer);
        });
    },
    methods: {
        onKeywordSearchFocus(type) {
            this.keywordSearchOpen[type] = true;
            this.ensureKeywordSearchList(type);
            if (this.keywordSearchQuery[type]) {
                this.queueKeywordSearch(type);
            }
        },
        onKeywordSearchBlur(type) {
            const timerKey = `${type}-blur`;
            if (this.keywordSearchTimers[timerKey]) {
                clearTimeout(this.keywordSearchTimers[timerKey]);
            }
            this.keywordSearchTimers[timerKey] = setTimeout(() => {
                this.keywordSearchOpen[type] = false;
            }, 200);
        },
        onKeywordSearchEscape(type) {
            this.keywordSearchOpen[type] = false;
        },
        onKeywordSearchInput(type) {
            this.queueKeywordSearch(type);
        },
        onKeywordSearchEnter(type) {
            const query = this.keywordSearchQuery[type]?.trim();
            if (!query) return;
            const value = this.keywordSearchResults[type][0] || query;
            this.onKeywordSearchSelect(type, value);
        },
        onKeywordSearchSelect(type, value) {
            const text = value?.toString().trim();
            if (!text) return;
            const index = this._appendTag(text);
            this.keywordSearchQuery[type] = "";
            this.keywordSearchResults[type] = [];
            this.keywordSearchError[type] = "";
            this.keywordSearchOpen[type] = false;
            if (index !== -1) {
                this.autoTranslateByIndexes([index]);
            }
        },
        queueKeywordSearch(type) {
            if (this.keywordSearchTimers[type]) {
                clearTimeout(this.keywordSearchTimers[type]);
            }
            this.keywordSearchTimers[type] = setTimeout(() => {
                this.updateKeywordSearchResults(type);
            }, 180);
        },
        async updateKeywordSearchResults(type) {
            const query = this.keywordSearchQuery[type]?.trim();
            if (!query) {
                this.keywordSearchResults[type] = [];
                this.keywordSearchError[type] = "";
                return;
            }
            const currentQuery = query;
            const list = await this.ensureKeywordSearchList(type);
            if (this.keywordSearchQuery[type]?.trim() !== currentQuery) return;
            if (!list.length) {
                this.keywordSearchResults[type] = [];
                return;
            }
            this.keywordSearchResults[type] = this._filterKeywordSearchResults(type, list, currentQuery);
        },
        async ensureKeywordSearchList(type) {
            if (keywordCache[type]) return keywordCache[type];
            this.keywordSearchLoading[type] = true;
            this.keywordSearchError[type] = "";
            try {
                return await this._loadKeywordSearchList(type);
            } catch (error) {
                console.error(error);
                this.keywordSearchError[type] = this.getLang("failed");
                return [];
            } finally {
                this.keywordSearchLoading[type] = false;
            }
        },
        _loadKeywordSearchList(type) {
            const config = KEYWORD_SOURCES[type];
            if (!config) return Promise.resolve([]);
            if (keywordCache[type]) return Promise.resolve(keywordCache[type]);
            if (keywordLoading[type]) return keywordLoading[type];
            keywordLoading[type] = fetch(config.url)
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Failed to load keyword list: ${res.status}`);
                    }
                    return res.text();
                })
                .then((text) => this._parseKeywordSearchList(text, type))
                .then((list) => {
                    keywordCache[type] = list;
                    return list;
                })
                .finally(() => {
                    delete keywordLoading[type];
                });
            return keywordLoading[type];
        },
        _parseKeywordSearchList(text, type) {
            const config = KEYWORD_SOURCES[type];
            if (!config) return [];
            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
            });
            const seen = new Set();
            const list = [];
            parsed.data.forEach((row) => {
                const value = row?.[config.column]?.toString().trim();
                if (!value || seen.has(value)) return;
                seen.add(value);
                const search = value.toLowerCase();
                const entry = { value, search };
                if (type === "tag") {
                    entry.searchReadable = search.replace(/[_-]+/g, " ");
                }
                list.push(entry);
            });
            return list;
        },
        _filterKeywordSearchResults(type, list, query) {
            const normalized = query.toLowerCase().trim();
            if (!normalized) return [];
            const tokens = this._keywordSearchTokens(type, normalized);
            const prefixMatches = [];
            const containsMatches = [];
            for (const item of list) {
                if (prefixMatches.length >= KEYWORD_MAX_RESULTS && containsMatches.length >= KEYWORD_MAX_RESULTS) {
                    break;
                }
                const searchReadable = item.searchReadable || "";
                const hasPrefix = tokens.some((token) => {
                    if (!token) return false;
                    return item.search.startsWith(token) || (searchReadable && searchReadable.startsWith(token));
                });
                if (hasPrefix) {
                    if (prefixMatches.length < KEYWORD_MAX_RESULTS) {
                        prefixMatches.push(item.value);
                    }
                    continue;
                }
                const hasInclude = tokens.some((token) => {
                    if (!token) return false;
                    return item.search.includes(token) || (searchReadable && searchReadable.includes(token));
                });
                if (hasInclude && containsMatches.length < KEYWORD_MAX_RESULTS) {
                    containsMatches.push(item.value);
                }
            }
            const results = [...prefixMatches];
            if (results.length < KEYWORD_MAX_RESULTS) {
                results.push(...containsMatches.slice(0, KEYWORD_MAX_RESULTS - results.length));
            }
            return results;
        },
        _keywordSearchTokens(type, query) {
            const tokens = new Set([query]);
            if (type === "tag") {
                tokens.add(query.replace(/\s+/g, "_"));
                tokens.add(query.replace(/[_-]+/g, " "));
            }
            return Array.from(tokens).filter((token) => token);
        },
    },
};
