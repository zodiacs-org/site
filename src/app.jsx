    const { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } = React;
    const REGISTRY_VIEW = document.querySelector('meta[name="zodiacs-registry-view"]')?.content ?? '';
    const TERMINAL_VIEW_STORAGE_KEY = 'zodiacs:terminal-view:v1';
    const TERMINAL_RANKS = new Set(['marketCap', 'liquidity', 'change']);
    const TERMINAL_LEGACY_PRO_HASHES = Object.freeze({
      market: 'market',
      briefing: 'briefing',
      research: 'research',
      outlook: 'briefing',
    });

    function trackAnalytics(name, properties = {}) {
      window.zodiacsAnalytics?.track?.(name, properties);
    }

    function validTerminalSign(value) {
      const normalized = String(value || '').toLowerCase();
      return SIGNS?.find?.((item) => item.asset.sign === normalized || item.ticker.toLowerCase() === normalized) || null;
    }

    function terminalViewHref(view, sign, { keepRank = false, hash = '' } = {}) {
      const path = view === 'pro' ? '/terminal/' : '/astrofolio/';
      const params = new URLSearchParams();
      if (sign?.asset?.sign) params.set('sign', sign.asset.sign);
      if (keepRank) {
        try {
          const rank = new URLSearchParams(window.location.search).get('rank');
          if (TERMINAL_RANKS.has(rank)) params.set('rank', rank);
        } catch { /* malformed URL: omit optional rank */ }
      }
      return `${path}${params.size ? `?${params}` : ''}${hash ? `#${hash}` : ''}`;
    }

    function rememberTerminalView(view, surface, direction) {
      try { window.localStorage.setItem(TERMINAL_VIEW_STORAGE_KEY, view); } catch { /* storage may be unavailable */ }
      trackAnalytics('terminal_view_switch', { surface, direction });
    }

    // IntersectionObserver-driven scroll reveal — no static mount.
    // Returns a ref-callback that adds `is-in` once the element enters.
    // Fires as a section approaches (small threshold, forward margin) so
    // the page never presents a viewport of unrevealed black on the way down.
    function useReveal(threshold = 0.05) {
      return useCallback((el) => {
        if (!el) return;
        // Hash navigation can place a section in the viewport before its
        // observer is attached. Reveal that target synchronously so a direct
        // /astrofolio/#thesis visit never lands on an invisible panel.
        const rect = el.getBoundingClientRect();
        const isHashTarget = el.id && window.location.hash === `#${el.id}`;
        const isAlreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (isHashTarget || isAlreadyVisible) {
          el.classList.add('is-in');
          // The static shell can resolve the hash before React has inserted
          // feature-flagged cards. Re-anchor after that layout is committed so
          // the floating navigation never covers the section introduction.
          if (isHashTarget) {
            window.requestAnimationFrame(() => {
              el.scrollIntoView({ block: 'start', behavior: 'instant' });
            });
          }
          return;
        }
        if (!('IntersectionObserver' in window)) {
          el.classList.add('is-in');
          return;
        }
        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            el.classList.add('is-in');
            io.disconnect();
          }
        }, { threshold, rootMargin: '0px 0px 12% 0px' });
        io.observe(el);
      }, [threshold]);
    }

    // ──────────────────────────────────────────────────────────────
    // Canonical registry data. This mirrors /registry/zodiacs.registry.json
    // and the @zodiacs/sdk registry schema: one sign identity, one native
    // Solana SPL representation, and one official bridged Base ERC-20
    // representation. The UI derives its display model from this object
    // instead of maintaining a second address shape.
    // ──────────────────────────────────────────────────────────────
    const ZODIACS_REGISTRY = {
          "name": "Zodiacs Official Registry",
          "source": "https://zodiacs.org",
          "sdk": "@zodiacs/sdk",
          "version": "0.2.0",
          "nativeChain": "solana",
          "supportedChains": [
                {
                      "chain": "solana",
                      "kind": "native",
                      "tokenStandard": "SPL"
                },
                {
                      "chain": "base",
                      "chainId": 8453,
                      "kind": "bridged",
                      "tokenStandard": "ERC20"
                }
          ],
          "assets": [
                {
                      "sign": "aries",
                      "displayName": "Aries",
                      "metadata": {
                            "element": "fire",
                            "modality": "cardinal",
                            "rulingPlanet": "Mars",
                            "archetype": "The Initiator",
                            "dateRange": "03-21 to 04-19",
                            "shortBio": "A cultural asset for symbolic identity expressed through origin, force, and first movement."
                      },
                      "native": {
                            "sign": "aries",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "GhFiFrExPY3proVF96oth1gESWA5QPQzdtb8cy8b1YZv",
                            "decimals": 6,
                            "symbol": "ARIES",
                            "name": "Aries",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "aries",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "GhFiFrExPY3proVF96oth1gESWA5QPQzdtb8cy8b1YZv",
                                  "decimals": 6,
                                  "symbol": "ARIES",
                                  "name": "Aries",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "aries",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0x3ffB5282F5891Dd8c813E64059EdB0607537eC91",
                                  "decimals": 6,
                                  "symbol": "ARIES",
                                  "name": "Aries",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "GhFiFrExPY3proVF96oth1gESWA5QPQzdtb8cy8b1YZv",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "taurus",
                      "displayName": "Taurus",
                      "metadata": {
                            "element": "earth",
                            "modality": "fixed",
                            "rulingPlanet": "Venus",
                            "archetype": "The Steward",
                            "dateRange": "04-20 to 05-20",
                            "shortBio": "A cultural asset for ownership, form, value, and symbolic endurance."
                      },
                      "native": {
                            "sign": "taurus",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "EjkkxYpfSwS6TAtKKuiJuNMMngYvumc1t1v9ZX1WJKMp",
                            "decimals": 6,
                            "symbol": "TAURUS",
                            "name": "Taurus",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "taurus",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "EjkkxYpfSwS6TAtKKuiJuNMMngYvumc1t1v9ZX1WJKMp",
                                  "decimals": 6,
                                  "symbol": "TAURUS",
                                  "name": "Taurus",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "taurus",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0xd5356c6E529569c6912978433DAfb7ca72B5f09C",
                                  "decimals": 6,
                                  "symbol": "TAURUS",
                                  "name": "Taurus",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "EjkkxYpfSwS6TAtKKuiJuNMMngYvumc1t1v9ZX1WJKMp",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "gemini",
                      "displayName": "Gemini",
                      "metadata": {
                            "element": "air",
                            "modality": "mutable",
                            "rulingPlanet": "Mercury",
                            "archetype": "The Messenger",
                            "dateRange": "05-21 to 06-20",
                            "shortBio": "A cultural asset for symbolic identity shaped by language, duality, and exchange."
                      },
                      "native": {
                            "sign": "gemini",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "ARiZfq6dK19uNqxWyRudhbM2MswLyYhVUHdndGkffdGc",
                            "decimals": 6,
                            "symbol": "GEMINI",
                            "name": "Gemini",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "gemini",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "ARiZfq6dK19uNqxWyRudhbM2MswLyYhVUHdndGkffdGc",
                                  "decimals": 6,
                                  "symbol": "GEMINI",
                                  "name": "Gemini",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "gemini",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0x8F6eb25aB4CD2F8f064f7da5E35136D4EC600b4f",
                                  "decimals": 6,
                                  "symbol": "GEMINI",
                                  "name": "Gemini",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "ARiZfq6dK19uNqxWyRudhbM2MswLyYhVUHdndGkffdGc",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "cancer",
                      "displayName": "Cancer",
                      "metadata": {
                            "element": "water",
                            "modality": "cardinal",
                            "rulingPlanet": "Luna",
                            "archetype": "The Keeper",
                            "dateRange": "06-21 to 07-22",
                            "shortBio": "A cultural asset for memory, protection, belonging, and ancestral continuity."
                      },
                      "native": {
                            "sign": "cancer",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "CmomKM8iPKRSMN7y1jqyW1QKj5bGoZmbvNZXWBJSUdnZ",
                            "decimals": 6,
                            "symbol": "CANCER",
                            "name": "Cancer",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "cancer",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "CmomKM8iPKRSMN7y1jqyW1QKj5bGoZmbvNZXWBJSUdnZ",
                                  "decimals": 6,
                                  "symbol": "CANCER",
                                  "name": "Cancer",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "cancer",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0xb9Fd3c3157C7b69260Ca285FbbC74F6309226378",
                                  "decimals": 6,
                                  "symbol": "CANCER",
                                  "name": "Cancer",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "CmomKM8iPKRSMN7y1jqyW1QKj5bGoZmbvNZXWBJSUdnZ",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "leo",
                      "displayName": "Leo",
                      "metadata": {
                            "element": "fire",
                            "modality": "fixed",
                            "rulingPlanet": "Sun",
                            "archetype": "The Sovereign",
                            "dateRange": "07-23 to 08-22",
                            "shortBio": "A cultural asset for presence, authorship, radiance, and recognition."
                      },
                      "native": {
                            "sign": "leo",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm",
                            "decimals": 6,
                            "symbol": "LEO",
                            "name": "Leo",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "leo",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm",
                                  "decimals": 6,
                                  "symbol": "LEO",
                                  "name": "Leo",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "leo",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0x4f7B4c12DE5d47314C86Ed3BA25E289aA139CF75",
                                  "decimals": 6,
                                  "symbol": "LEO",
                                  "name": "Leo",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "virgo",
                      "displayName": "Virgo",
                      "metadata": {
                            "element": "earth",
                            "modality": "mutable",
                            "rulingPlanet": "Mercury",
                            "archetype": "The Archivist",
                            "dateRange": "08-23 to 09-22",
                            "shortBio": "A cultural asset for craft, discernment, service, and exacting order."
                      },
                      "native": {
                            "sign": "virgo",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "Ez4bst5qu5uqX3AntYWUdafw9XvtFeJ3gugytKKbSJso",
                            "decimals": 6,
                            "symbol": "VIRGO",
                            "name": "Virgo",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "virgo",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "Ez4bst5qu5uqX3AntYWUdafw9XvtFeJ3gugytKKbSJso",
                                  "decimals": 6,
                                  "symbol": "VIRGO",
                                  "name": "Virgo",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "virgo",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0xAcFd97106bbE5D931aC430Be76A8E362832D48f4",
                                  "decimals": 6,
                                  "symbol": "VIRGO",
                                  "name": "Virgo",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "Ez4bst5qu5uqX3AntYWUdafw9XvtFeJ3gugytKKbSJso",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "libra",
                      "displayName": "Libra",
                      "metadata": {
                            "element": "air",
                            "modality": "cardinal",
                            "rulingPlanet": "Venus",
                            "archetype": "The Arbiter",
                            "dateRange": "09-23 to 10-22",
                            "shortBio": "A cultural asset for relation, judgment, proportion, and civic balance."
                      },
                      "native": {
                            "sign": "libra",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "7Zt2KUh5mkpEpPGcNcFy51aGkh9Ycb5ELcqRH1n2GmAe",
                            "decimals": 6,
                            "symbol": "LIBRA",
                            "name": "Libra",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "libra",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "7Zt2KUh5mkpEpPGcNcFy51aGkh9Ycb5ELcqRH1n2GmAe",
                                  "decimals": 6,
                                  "symbol": "LIBRA",
                                  "name": "Libra",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "libra",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0x4201eff5F419CD6EEDFb28fa240edeaFc9002204",
                                  "decimals": 6,
                                  "symbol": "LIBRA",
                                  "name": "Libra",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "7Zt2KUh5mkpEpPGcNcFy51aGkh9Ycb5ELcqRH1n2GmAe",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "scorpio",
                      "displayName": "Scorpio",
                      "metadata": {
                            "element": "water",
                            "modality": "fixed",
                            "rulingPlanet": "Mars",
                            "archetype": "The Custodian",
                            "dateRange": "10-23 to 11-21",
                            "shortBio": "A cultural asset for depth, transformation, secrecy, and resolve."
                      },
                      "native": {
                            "sign": "scorpio",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "J4fQTRN13MKpXhVE74t99msKJLbrjegjEgLBnzEv2YH1",
                            "decimals": 6,
                            "symbol": "SCORPIO",
                            "name": "Scorpio",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "scorpio",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "J4fQTRN13MKpXhVE74t99msKJLbrjegjEgLBnzEv2YH1",
                                  "decimals": 6,
                                  "symbol": "SCORPIO",
                                  "name": "Scorpio",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "scorpio",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0x0057C9cB6D16C2ecA808788f14d0d0c367b26676",
                                  "decimals": 6,
                                  "symbol": "SCORPIO",
                                  "name": "Scorpio",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "J4fQTRN13MKpXhVE74t99msKJLbrjegjEgLBnzEv2YH1",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "sagittarius",
                      "displayName": "Sagittarius",
                      "metadata": {
                            "element": "fire",
                            "modality": "mutable",
                            "rulingPlanet": "Jupiter",
                            "archetype": "The Wayfinder",
                            "dateRange": "11-22 to 12-21",
                            "shortBio": "A cultural asset for doctrine, journey, horizon, and the search for meaning."
                      },
                      "native": {
                            "sign": "sagittarius",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "8x17zMmVjJxqswjX4hNpxVPc7Tr5UabVJF3kv8TKq8Y3",
                            "decimals": 6,
                            "symbol": "SAGITTARIUS",
                            "name": "Sagittarius",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "sagittarius",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "8x17zMmVjJxqswjX4hNpxVPc7Tr5UabVJF3kv8TKq8Y3",
                                  "decimals": 6,
                                  "symbol": "SAGITTARIUS",
                                  "name": "Sagittarius",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "sagittarius",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0xD21fAb1EB5E11AC3C281F7cF8096eCC4683eEa9c",
                                  "decimals": 6,
                                  "symbol": "SAGITTARIUS",
                                  "name": "Sagittarius",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "8x17zMmVjJxqswjX4hNpxVPc7Tr5UabVJF3kv8TKq8Y3",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "capricorn",
                      "displayName": "Capricorn",
                      "metadata": {
                            "element": "earth",
                            "modality": "cardinal",
                            "rulingPlanet": "Saturn",
                            "archetype": "The Institution",
                            "dateRange": "12-22 to 01-19",
                            "shortBio": "A cultural asset for structure, time, ascent, and institutional memory."
                      },
                      "native": {
                            "sign": "capricorn",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "3C2SN1FjzE9MiLFFVRp7Jhkp8Gjwpk29S2TCSJ2jkHn2",
                            "decimals": 6,
                            "symbol": "CAPRICORN",
                            "name": "Capricorn",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "capricorn",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "3C2SN1FjzE9MiLFFVRp7Jhkp8Gjwpk29S2TCSJ2jkHn2",
                                  "decimals": 6,
                                  "symbol": "CAPRICORN",
                                  "name": "Capricorn",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "capricorn",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0xbFB102C18FDf49f2ffCB9B3aF4522f7DC9f51018",
                                  "decimals": 6,
                                  "symbol": "CAPRICORN",
                                  "name": "Capricorn",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "3C2SN1FjzE9MiLFFVRp7Jhkp8Gjwpk29S2TCSJ2jkHn2",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "aquarius",
                      "displayName": "Aquarius",
                      "metadata": {
                            "element": "air",
                            "modality": "fixed",
                            "rulingPlanet": "Saturn",
                            "archetype": "The Architect",
                            "dateRange": "01-20 to 02-18",
                            "shortBio": "A cultural asset for systems, invention, collective identity, and distance."
                      },
                      "native": {
                            "sign": "aquarius",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "C49Ut3om3QFTDrMZ5Cr8VcTKPpHDcQ2Fv8mmuJHHigDt",
                            "decimals": 6,
                            "symbol": "AQUARIUS",
                            "name": "Aquarius",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "aquarius",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "C49Ut3om3QFTDrMZ5Cr8VcTKPpHDcQ2Fv8mmuJHHigDt",
                                  "decimals": 6,
                                  "symbol": "AQUARIUS",
                                  "name": "Aquarius",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "aquarius",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0xccA7CD4F96336Fd26eF6c5F579eaC651bAC5535F",
                                  "decimals": 6,
                                  "symbol": "AQUARIUS",
                                  "name": "Aquarius",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "C49Ut3om3QFTDrMZ5Cr8VcTKPpHDcQ2Fv8mmuJHHigDt",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                },
                {
                      "sign": "pisces",
                      "displayName": "Pisces",
                      "metadata": {
                            "element": "water",
                            "modality": "mutable",
                            "rulingPlanet": "Jupiter",
                            "archetype": "The Mystic",
                            "dateRange": "02-19 to 03-20",
                            "shortBio": "A cultural asset for image, faith, continuity, and symbolic dissolution."
                      },
                      "native": {
                            "sign": "pisces",
                            "chain": "solana",
                            "kind": "native",
                            "tokenStandard": "SPL",
                            "address": "3JsSsmGzjWDNe9XCw2L9vznC5JU9wSqQeB6ns5pAkPeE",
                            "decimals": 6,
                            "symbol": "PISCES",
                            "name": "Pisces",
                            "isCanonicalOrigin": true,
                            "isOfficialRepresentation": true
                      },
                      "representations": [
                            {
                                  "sign": "pisces",
                                  "chain": "solana",
                                  "kind": "native",
                                  "tokenStandard": "SPL",
                                  "address": "3JsSsmGzjWDNe9XCw2L9vznC5JU9wSqQeB6ns5pAkPeE",
                                  "decimals": 6,
                                  "symbol": "PISCES",
                                  "name": "Pisces",
                                  "isCanonicalOrigin": true,
                                  "isOfficialRepresentation": true
                            },
                            {
                                  "sign": "pisces",
                                  "chain": "base",
                                  "chainId": 8453,
                                  "kind": "bridged",
                                  "tokenStandard": "ERC20",
                                  "address": "0x43fA1855a89b7A3e07426Fa7a1B44b4187d29Daf",
                                  "decimals": 6,
                                  "symbol": "PISCES",
                                  "name": "Pisces",
                                  "isCanonicalOrigin": false,
                                  "isOfficialRepresentation": true,
                                  "originChain": "solana",
                                  "originAddress": "3JsSsmGzjWDNe9XCw2L9vznC5JU9wSqQeB6ns5pAkPeE",
                                  "bridge": {
                                        "status": "official-bridged",
                                        "protocol": "wormhole",
                                        "sourceChain": "solana",
                                        "destinationChain": "base",
                                        "notes": "Official bridged Base representation deployed through Wormhole BridgeToken contracts."
                                  }
                            }
                      ]
                }
          ]
    };

    const SITE_SIGN_COPY = {
          "aries": {
                "sign": "aries",
                "order": 1,
                "symbol": "♈︎",
                "shortBio": "The first spark. Aries marks the vernal equinox, long honored across civilizations as the renewal of time and the opening of the symbolic year."
          },
          "taurus": {
                "sign": "taurus",
                "order": 2,
                "symbol": "♉︎",
                "shortBio": "The bull held sacred from Çatalhöyük to Knossos. Taurus carries a long memory of fertility, endurance, and material stewardship."
          },
          "gemini": {
                "sign": "gemini",
                "order": 3,
                "symbol": "♊︎",
                "shortBio": "The twins. From Castor and Pollux to the dual nature of language itself, Gemini holds the symbol of human exchange and discourse."
          },
          "cancer": {
                "sign": "cancer",
                "order": 4,
                "symbol": "♋︎",
                "shortBio": "The crab at the summer solstice. Cancer preserves the ancient image of home, memory, and the inner tide."
          },
          "leo": {
                "sign": "leo",
                "order": 5,
                "symbol": "♌︎",
                "shortBio": "The lion. Older than empires. Leo carries the sun at the height of summer. The symbol of radiant authority and visible self."
          },
          "virgo": {
                "sign": "virgo",
                "order": 6,
                "symbol": "♍︎",
                "shortBio": "The maiden of the harvest. Virgo preserves the long lineage of craft, discernment, and the discipline of measure."
          },
          "libra": {
                "sign": "libra",
                "order": 7,
                "symbol": "♎︎",
                "shortBio": "The scales. The autumn equinox. Libra holds the symbol of balance, civic measure, and the law as a cultural form."
          },
          "scorpio": {
                "sign": "scorpio",
                "order": 8,
                "symbol": "♏︎",
                "shortBio": "The scorpion of the deep year. Scorpio carries the rites of transformation. The threshold between what passes and what endures."
          },
          "sagittarius": {
                "sign": "sagittarius",
                "order": 9,
                "symbol": "♐︎",
                "shortBio": "The archer at the galactic center. Sagittarius preserves the impulse to travel, to inquire, to chart what lies beyond the known."
          },
          "capricorn": {
                "sign": "capricorn",
                "order": 10,
                "symbol": "♑︎",
                "shortBio": "The sea-goat. The winter solstice. Capricorn carries the long pattern of structure, lineage, and the building of enduring forms."
          },
          "aquarius": {
                "sign": "aquarius",
                "order": 11,
                "symbol": "♒︎",
                "shortBio": "The water-bearer. Aquarius holds the symbol of the unbound mind: invention, dissent, the long arc of cultural shift."
          },
          "pisces": {
                "sign": "pisces",
                "order": 12,
                "symbol": "♓︎",
                "shortBio": "Two fishes bound by a silver cord. Pisces closes the wheel. The symbol of dissolution, depth, and the world before the next renewal."
          }
    };

    const SIGN_HUES = {
      aries: '#DE8E79',
      taurus: '#B9D4BE',
      gemini: '#B29DD0',
      cancer: '#B6D4E4',
      leo: '#E0A9B4',
      virgo: '#B7D9B0',
      libra: '#D3A9DE',
      scorpio: '#B9DCE8',
      sagittarius: '#E0B080',
      capricorn: '#C0DEA8',
      aquarius: '#AE8FC9',
      pisces: '#A9D4C4'
    };

    const titleCase = (value) => value
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value;

    function representationFor(asset, chain) {
      return asset.representations.find((representation) => representation.chain === chain);
    }

    function toDisplaySign(asset) {
      const copy = SITE_SIGN_COPY[asset.sign] || {};
      const solana = representationFor(asset, 'solana');
      const base = representationFor(asset, 'base');

      return {
        asset,
        name: asset.displayName,
        ticker: asset.native.symbol || asset.displayName.toUpperCase(),
        order: copy.order || ZODIACS_REGISTRY.assets.indexOf(asset) + 1,
        element: titleCase(asset.metadata.element),
        modality: titleCase(asset.metadata.modality),
        rulingPlanet: asset.metadata.rulingPlanet,
        symbol: copy.symbol || '',
        hue: SIGN_HUES[asset.sign] || '#B9D4BE',
        archetype: asset.metadata.archetype,
        shortBio: copy.shortBio || asset.metadata.shortBio,
        representations: { solana, base }
      };
    }

    const SIGNS = ZODIACS_REGISTRY.assets.map(toDisplaySign);
    const REGISTRY_OUTLOOK_URL = '/assets/registry-outlook.json';

    // The source renders share a 512px canvas, but their visible silhouettes
    // do not share the same optical centre. These restrained corrections keep
    // horns, bows, claws and feet inside one mobile museum stage without
    // altering the canonical artwork.
    const SCULPTURE_PRESENTATION = Object.freeze({
      aries:       { scale: 0.94, translateY: '-1.5%' },
      taurus:      { scale: 1.00, translateY: '2.5%' },
      gemini:      { scale: 0.94, translateY: '-1.0%' },
      cancer:      { scale: 1.00, translateY: '2.5%' },
      leo:         { scale: 1.00, translateY: '2.0%' },
      virgo:       { scale: 0.93, translateY: '-1.5%' },
      libra:       { scale: 0.94, translateY: '-1.0%' },
      scorpio:     { scale: 0.93, translateY: '-1.0%' },
      sagittarius: { scale: 0.92, translateY: '-1.0%' },
      capricorn:   { scale: 0.94, translateY: '-1.0%' },
      aquarius:    { scale: 0.94, translateY: '-1.0%' },
      pisces:      { scale: 0.96, translateY: '0%' },
    });

    // Current zodiac season, derived from registry dateRange metadata
    // ("MM-DD to MM-DD"). Capricorn wraps the year boundary. UTC calendar
    // time and the registry range are the source of truth, not astronomical
    // ingress, so a release, its share card, and every visitor agree on the
    // same season boundary.
    function parseDateRange(range) {
      const m = /^(\d{2})-(\d{2}) to (\d{2})-(\d{2})$/.exec(range || '');
      return m ? { sm: +m[1], sd: +m[2], em: +m[3], ed: +m[4] } : null;
    }

    function currentSeason(now = new Date()) {
      const md = (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
      for (const sign of SIGNS) {
        const r = parseDateRange(sign.asset.metadata.dateRange);
        if (!r) continue;
        const start = r.sm * 100 + r.sd;
        const end = r.em * 100 + r.ed;
        const inSeason = start <= end
          ? (md >= start && md <= end)
          : (md >= start || md <= end);
        if (!inSeason) continue;
        const wraps = start > end;
        const currentYear = now.getUTCFullYear();
        const startYear = wraps && md <= end ? currentYear - 1 : currentYear;
        const endYear = startYear + (wraps ? 1 : 0);
        const ordinal = (year, month, day) => Date.UTC(year, month - 1, day);
        const today = ordinal(currentYear, now.getUTCMonth() + 1, now.getUTCDate());
        const seasonStart = ordinal(startYear, r.sm, r.sd);
        const seasonEnd = ordinal(endYear, r.em, r.ed);
        const day = Math.round((today - seasonStart) / 86400000) + 1;
        const total = Math.round((seasonEnd - seasonStart) / 86400000) + 1;
        return {
          sign,
          day,
          total,
          remaining: Math.max(0, total - day),
          ends: new Date(Date.UTC(endYear, r.em - 1, r.ed))
        };
      }
      return null;
    }

    function useCurrentSeason() {
      const [season, setSeason] = useState(() => currentSeason());
      useEffect(() => {
        let timer = 0;
        const schedule = () => {
          const now = new Date();
          const nextDay = new Date(Date.UTC(
            now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 2
          ));
          timer = window.setTimeout(() => {
            setSeason(currentSeason());
            schedule();
          }, Math.max(1000, nextDay.getTime() - now.getTime()));
        };
        schedule();
        return () => window.clearTimeout(timer);
      }, []);
      return season;
    }

    function registryProfilePath(sign) {
      return `/registry/${sign?.asset?.sign ?? 'aries'}/`;
    }

    function howToBuyPath(sign) {
      return `/astrofolio/how-to-buy/${sign?.asset?.sign ?? 'aries'}/`;
    }

    const FOMO_SOLANA_CHAIN_ID = '1399811149';
    const SOLANA_WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
    function fomoBuyPath(sign) {
      const mint = sign?.representations?.solana?.address;
      if (!mint) return 'https://fomo.family/download';
      return `https://fomo.family/coin?address=${encodeURIComponent(mint)}&chainId=${FOMO_SOLANA_CHAIN_ID}`;
    }

    function signDateLabel(sign) {
      const range = parseDateRange(sign?.asset?.metadata?.dateRange);
      if (!range) return sign?.asset?.metadata?.dateRange || '';
      const date = (month, day) => new Date(2024, month - 1, day)
        .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `${date(range.sm, range.sd)} – ${date(range.em, range.ed)}`;
    }

    function zodiacEmoji(sign) {
      const symbol = String(sign?.symbol || '').replace(/[\uFE0E\uFE0F]/gu, '');
      return symbol ? `${symbol}\uFE0F` : '';
    }

    const ZODIAC_MARKET_PAIRS = {
      aries: {
        chainId: 'solana',
        pairId: 'HRn98YLGigP475eS1GaQYRMbqk1V4dkV6tdKyLhVh2iS'
      },
      taurus: {
        chainId: 'solana',
        pairId: '2GNtxia4fLW3URj5MLqVfgoKrAgDpphtAVazK41eTPfu'
      },
      gemini: {
        chainId: 'solana',
        pairId: 'HxhdKrB1UpSwfuMoZMVzPVELzbPWHdyN6PHU9CBFium9'
      },
      cancer: {
        chainId: 'solana',
        pairId: 'DaTEcH6da4i1evZU37F9ibQirYXhLKZpKDzDno346nSW'
      },
      leo: {
        chainId: 'solana',
        pairId: '48ErBGMqiZekyLoCcebd7cS5KNQPzqr7QQAK9mzAPQGQ'
      },
      virgo: {
        chainId: 'solana',
        pairId: '5WcVjf8fzPkHaZqTSZDdbDFL6p2bLbAgEigxpevNrcRh'
      },
      libra: {
        chainId: 'solana',
        pairId: 'DTXPQjK4ae4h2Wc7D5Rpij8YmSQxqLuTcNKrpBCjcAN9'
      },
      scorpio: {
        chainId: 'solana',
        pairId: '3d2KYuMgj2yotNC6SKX4HNoeSWp4n8zqZSQ9kFH81Yta'
      },
      sagittarius: {
        chainId: 'solana',
        pairId: '7mP6WeVYBNt3eao5szsMPmuHughHjNRx26TcrgJXZRky'
      },
      capricorn: {
        chainId: 'solana',
        pairId: '549aknNCvxbiqmikS6sAnY6Dbg37MeENWn6ZFBfc7sin'
      },
      aquarius: {
        chainId: 'solana',
        pairId: 'BygCEAhCNyWC8Co9yPa4K84NGkgkgMWdib2FG5hhuiUv'
      },
      pisces: {
        chainId: 'solana',
        pairId: 'Fzz8QrSV8sPKsTtHocwYARE8Zo6Rd4Wv2Ee4JtCuiDko'
      }
    };

    const MARKET_CONTEXT_CACHE = new Map();
    const unavailableMarketContext = (reason = 'unavailable') => ({
      status: 'unavailable',
      reason
    });
    const toFiniteNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const toNonNegativeNumber = (value) => {
      const n = toFiniteNumber(value);
      return n !== null && n >= 0 ? n : null;
    };
    function formatPriceUsd(value) {
      const n = toFiniteNumber(value);
      if (n === null) return '—';
      if (Math.abs(n) >= 1) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const decimals = Math.abs(n) < 0.0001 ? 8 : Math.abs(n) < 0.01 ? 6 : 4;
      return `$${n.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '')}`;
    }
    function formatUsdCompact(value) {
      const n = toFiniteNumber(value);
      if (n === null) return '—';
      const abs = Math.abs(n);
      const compact = (divisor, suffix) => `$${(n / divisor).toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
      if (abs >= 1_000_000_000) return compact(1_000_000_000, 'B');
      if (abs >= 1_000_000) return compact(1_000_000, 'M');
      if (abs >= 1_000) return compact(1_000, 'K');
      return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    function formatPercent(value) {
      const n = toFiniteNumber(value);
      if (n === null) return '—';
      const sign = n > 0 ? '+' : '';
      return `${sign}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    }
    function formatDexId(value) {
      if (!value) return '—';
      return String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    function formatPairDate(value) {
      const n = toFiniteNumber(value);
      if (n === null) return '—';
      const date = new Date(n);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    function parseMarketContextPayload(payload, config) {
      const pairs = Array.isArray(payload?.pairs) ? payload.pairs : null;
      if (!pairs?.length) return unavailableMarketContext('no-pair');
      const pair = pairs.find((item) => item?.pairAddress === config.pairId) || null;
      if (
        !pair
        || pair.chainId !== config.chainId
        || pair.baseToken?.address !== config.baseMint
        || pair.quoteToken?.address !== SOLANA_WRAPPED_SOL_MINT
      ) {
        return unavailableMarketContext('malformed');
      }
      return {
        status: 'ok',
        pair: {
          chainId: pair.chainId,
          dexId: pair.dexId || '',
          url: pair.url || '',
          pairAddress: pair.pairAddress,
          priceUsd: pair.priceUsd,
          priceChange24h: pair.priceChange?.h24,
          liquidityUsd: toNonNegativeNumber(pair.liquidity?.usd),
          marketCap: toNonNegativeNumber(pair.marketCap),
          fdv: toNonNegativeNumber(pair.fdv),
          pairCreatedAt: pair.pairCreatedAt
        }
      };
    }
    function parseTokenMarketPayload(payload, mint) {
      const pairs = Array.isArray(payload) ? payload : payload?.pairs;
      if (!Array.isArray(pairs) || !pairs.length) return unavailableMarketContext('no-pair');
      let best = null;
      let bestLiquidity = -1;
      for (const pair of pairs) {
        if (
          pair?.chainId !== 'solana'
          || !pair?.pairAddress
          || pair.baseToken?.address !== mint
          || pair.quoteToken?.address !== SOLANA_WRAPPED_SOL_MINT
        ) continue;
        const liquidity = toFiniteNumber(pair.liquidity?.usd) ?? 0;
        if (liquidity > bestLiquidity) {
          bestLiquidity = liquidity;
          best = pair;
        }
      }
      if (!best) return unavailableMarketContext('no-pair');
      return {
        status: 'ok',
        pair: {
          chainId: best.chainId,
          dexId: best.dexId || '',
          url: best.url || '',
          pairAddress: best.pairAddress,
          priceUsd: best.priceUsd,
          priceChange24h: best.priceChange?.h24,
          liquidityUsd: toNonNegativeNumber(best.liquidity?.usd),
          // Market capitalization and fully diluted valuation are different
          // upstream fields. Never relabel FDV when reported cap is absent.
          marketCap: toNonNegativeNumber(best.marketCap),
          fdv: toNonNegativeNumber(best.fdv),
          pairCreatedAt: best.pairCreatedAt
        }
      };
    }
    function loadMarketContext(config) {
      // A sign with no pinned pair is quoted by its mint instead — the same
      // token endpoint the Market snapshot uses — taking the deepest pool.
      if (config?.tokenMint) {
        const key = `tokens:solana:${config.tokenMint}`;
        if (MARKET_CONTEXT_CACHE.has(key)) return MARKET_CONTEXT_CACHE.get(key);
        const url = `https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(config.tokenMint)}`;
        const request = fetch(url)
          .then(async (response) => {
            if (!response.ok) return unavailableMarketContext('http');
            let payload;
            try {
              payload = await response.json();
            } catch {
              return unavailableMarketContext('json');
            }
            return parseTokenMarketPayload(payload, config.tokenMint);
          })
          .catch(() => unavailableMarketContext('network'))
          .then((result) => {
            MARKET_CONTEXT_CACHE.set(key, Promise.resolve(result));
            return result;
          });
        MARKET_CONTEXT_CACHE.set(key, request);
        return request;
      }
      if (!config?.chainId || !config?.pairId) {
        return Promise.resolve(unavailableMarketContext('not-configured'));
      }
      const key = `${config.chainId}:${config.pairId}`;
      if (MARKET_CONTEXT_CACHE.has(key)) return MARKET_CONTEXT_CACHE.get(key);

      const url = `https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(config.chainId)}/${encodeURIComponent(config.pairId)}`;
      const request = fetch(url)
        .then(async (response) => {
          if (!response.ok) return unavailableMarketContext('http');
          let payload;
          try {
            payload = await response.json();
          } catch {
            return unavailableMarketContext('json');
          }
          return parseMarketContextPayload(payload, config);
        })
        .catch(() => unavailableMarketContext('network'))
        .then((result) => {
          MARKET_CONTEXT_CACHE.set(key, Promise.resolve(result));
          return result;
        });

      MARKET_CONTEXT_CACHE.set(key, request);
      return request;
    }

    // One token batch usually quotes all twelve without fanning out per sign.
    // If that answer omits an established SOL pool, one pair batch fills only
    // those gaps. Quote-asset pools can never replace a pair of record.
    const MARKET_DEADLINE_MS = 8000;
    const MARKET_REFRESH_MS = 120_000;
    let twelveQuotesResult = null;
    let twelveQuotesRequest = null;
    function fetchWithin(url, ms) {
      // Composed by hand — AbortSignal.timeout is still missing from Safari 15.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    }
    function fetchDexPairsWithin(url) {
      return fetchWithin(url, MARKET_DEADLINE_MS)
        .then(async (response) => {
          if (!response.ok) return [];
          let payload;
          try {
            payload = await response.json();
          } catch {
            return [];
          }
          const pairs = Array.isArray(payload) ? payload : payload?.pairs;
          return Array.isArray(pairs) ? pairs : [];
        })
        .catch(() => []);
    }
    function isPinnedPairForSign(pair, sign) {
      const config = ZODIAC_MARKET_PAIRS[sign?.asset?.sign];
      const mint = sign?.representations?.solana?.address;
      return Boolean(
        config
        && mint
        && pair?.chainId === config.chainId
        && pair?.pairAddress === config.pairId
        && pair?.baseToken?.address === mint
        && pair?.quoteToken?.address === SOLANA_WRAPPED_SOL_MINT
      );
    }
    function loadTwelveMarketQuotes() {
      const cachedAt = Date.parse(twelveQuotesResult?.observedAt || '');
      if (twelveQuotesResult?.status === 'ok'
        && Number.isFinite(cachedAt)
        && Date.now() - cachedAt < MARKET_REFRESH_MS) {
        return Promise.resolve(twelveQuotesResult);
      }
      if (twelveQuotesRequest) return twelveQuotesRequest;
      const mints = SIGNS.map((s) => s.representations.solana?.address).filter(Boolean);
      const requestedMints = new Set(mints);
      const tokenUrl = `https://api.dexscreener.com/tokens/v1/solana/${mints.join(',')}`;
      const request = fetchDexPairsWithin(tokenUrl)
        .then(async (tokenPairs) => {
          const missingPairIds = SIGNS
            .filter((sign) => !tokenPairs.some((pair) => isPinnedPairForSign(pair, sign)))
            .map((sign) => ZODIAC_MARKET_PAIRS[sign.asset.sign]?.pairId)
            .filter(Boolean);
          if (missingPairIds.length === 0) return [tokenPairs, []];
          const pinnedPairUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${missingPairIds.join(',')}`;
          const pinnedPairs = await fetchDexPairsWithin(pinnedPairUrl);
          return [tokenPairs, pinnedPairs];
        })
        .then(([tokenPairs, pinnedPairs]) => {
          const pairs = [...tokenPairs, ...pinnedPairs];
          if (pairs.length === 0) return unavailableMarketContext('no-pair');
          const markets = new Map();
          const pinnedPairsBySign = new Map();
          // A pool involving two indexed assets can appear more than once in
          // a token batch. Keep one collection-level liquidity observation per
          // chain/address so the Terminal never double-counts that pool.
          const indexedPools = new Map();
          for (const pair of pairs) {
            const mint = pair?.baseToken?.address;
            if (
              !mint
              || !requestedMints.has(mint)
              || !pair?.pairAddress
              || pair?.chainId !== 'solana'
              || pair?.quoteToken?.address !== SOLANA_WRAPPED_SOL_MINT
            ) continue;
            const liquidity = Math.max(0, toFiniteNumber(pair.liquidity?.usd) ?? 0);
            const poolKey = `${pair.chainId}:${pair.pairAddress}`;
            indexedPools.set(poolKey, Math.max(indexedPools.get(poolKey) ?? 0, liquidity));
            const market = markets.get(mint) || {
              liquidityUsd: 0,
              volume24h: 0,
              pairs: new Set(),
              bestLiquidity: -1,
              bestPair: null,
            };
            if (!market.pairs.has(pair.pairAddress)) {
              market.pairs.add(pair.pairAddress);
              market.liquidityUsd += liquidity;
              market.volume24h += Math.max(0, toFiniteNumber(pair.volume?.h24) ?? 0);
            }
            if (liquidity > market.bestLiquidity) {
              market.bestLiquidity = liquidity;
              market.bestPair = pair;
            }
            markets.set(mint, market);
            const pinnedSign = SIGNS.find((sign) => isPinnedPairForSign(pair, sign));
            if (pinnedSign) pinnedPairsBySign.set(pinnedSign.asset.sign, pair);
          }
          const quotes = {};
          let indexedPairs = 0;
          for (const sign of SIGNS) {
            const mint = sign.representations.solana?.address;
            const market = (mint && markets.get(mint)) || null;
            const configured = ZODIAC_MARKET_PAIRS[sign.asset.sign];
            // A configured sign fails closed when its pair of record is absent
            // or malformed. Never let an unrelated quote asset replace it.
            const pair = configured
              ? pinnedPairsBySign.get(sign.asset.sign) || null
              : market?.bestPair || null;
            quotes[sign.asset.sign] = pair
              ? {
                  priceUsd: pair.priceUsd,
                  priceChange24h: pair.priceChange?.h24,
                  marketCap: toNonNegativeNumber(pair.marketCap),
                  fdv: toNonNegativeNumber(pair.fdv),
                  liquidityUsd: market.liquidityUsd,
                  volume24h: market.volume24h,
                  poolCount: market.pairs.size,
                  pairAddress: pair.pairAddress,
                  url: pair.url || ''
                }
              : null;
            if (pair) indexedPairs += 1;
          }
          // An empty but syntactically valid upstream payload is not a live
          // zero-dollar market. Fail into the explicit unavailable state.
          if (indexedPairs === 0) return unavailableMarketContext('no-pair');
          return {
            status: 'ok',
            quotes,
            aggregate: {
              indexedLiquidityUsd: [...indexedPools.values()].reduce((sum, value) => sum + value, 0),
              indexedPoolCount: indexedPools.size,
            },
            observedAt: new Date().toISOString(),
          };
        })
        .catch(() => unavailableMarketContext('network'))
        .then((result) => {
          // A failed refresh never erases the last timestamped read. Hooks can
          // keep displaying it as stale while their short retry runs.
          if (result.status === 'ok') twelveQuotesResult = result;
          return result;
        });
      twelveQuotesRequest = request.finally(() => { twelveQuotesRequest = null; });
      return twelveQuotesRequest;
    }
    function useTwelveQuotes(enabled, retryKey = 0) {
      const [state, setState] = useState({ status: 'idle' });
      const [attempt, setAttempt] = useState(0);
      useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        let retryTimer = 0;
        setState((current) => current.status === 'ok'
          ? { ...current, refreshing: true }
          : { status: 'loading' });
        loadTwelveMarketQuotes().then((result) => {
          if (cancelled) return;
          setState((current) => result.status === 'ok'
            ? { ...result, refreshing: false, stale: false }
            : current.status === 'ok'
              ? { ...current, refreshing: false, stale: true }
              : result);
          retryTimer = window.setTimeout(
            () => setAttempt(value => value + 1),
            result.status === 'ok' ? MARKET_REFRESH_MS : 30_000,
          );
        });
        return () => {
          cancelled = true;
          window.clearTimeout(retryTimer);
        };
      }, [enabled, retryKey, attempt]);
      return state;
    }

    const REGISTRY_MARKET_HISTORY_URL = '/assets/data/registry-market-history.v1.json';
    const REGISTRY_NEWS_URL = '/api/registry/news';
    const REGISTRY_RESEARCH_FEED_URL = '/assets/registry-research-feed.json';
    let registryMarketHistoryRequest = null;
    let registryNewsRequest = null;
    let registryResearchRequest = null;
    const registryResourceCache = new Map();

    function loadRegistryJson(url, cachedRequest, setRequest) {
      if (registryResourceCache.has(url)) return Promise.resolve(registryResourceCache.get(url));
      if (cachedRequest) return cachedRequest;
      const request = fetch(url, {
        cache: 'no-cache',
        headers: { accept: 'application/json' },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          registryResourceCache.set(url, data);
          return data;
        });
      const held = request.finally(() => setRequest(null));
      setRequest(held);
      return held;
    }

    function loadRegistryMarketHistory() {
      return loadRegistryJson(
        REGISTRY_MARKET_HISTORY_URL,
        registryMarketHistoryRequest,
        (request) => { registryMarketHistoryRequest = request; },
      );
    }

    function loadRegistryNews() {
      return loadRegistryJson(
        REGISTRY_NEWS_URL,
        registryNewsRequest,
        (request) => { registryNewsRequest = request; },
      );
    }

    function loadRegistryResearch() {
      return loadRegistryJson(
        REGISTRY_RESEARCH_FEED_URL,
        registryResearchRequest,
        (request) => { registryResearchRequest = request; },
      );
    }

    function useRegistryResource(enabled, loader) {
      const [state, setState] = useState({ status: 'idle' });
      const [retryKey, setRetryKey] = useState(0);
      useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        setState(current => current.status === 'ok'
          ? { ...current, refreshing: true }
          : { status: 'loading' });
        loader()
          .then(data => {
            if (!cancelled) setState({ status: 'ok', data, refreshing: false });
          })
          .catch(() => {
            if (!cancelled) setState(current => current.status === 'ok'
              ? { ...current, stale: true, refreshing: false }
              : { status: 'unavailable' });
          });
        return () => { cancelled = true; };
      }, [enabled, loader, retryKey]);
      return { ...state, retry: () => setRetryKey(value => value + 1) };
    }

    function useRegistryMarketHistory(enabled) {
      return useRegistryResource(enabled, loadRegistryMarketHistory);
    }

    function useRegistryNews(enabled) {
      return useRegistryResource(enabled, loadRegistryNews);
    }

    function marketHistoryForSign(archive, slug) {
      const snapshots = Array.isArray(archive?.snapshots) ? archive.snapshots : [];
      const observations = snapshots
        .map((snapshot) => {
          const asset = snapshot?.assets?.find(item => item.sign === slug) ?? null;
          return {
            date: snapshot.date,
            observedAt: snapshot.source?.readAt ?? `${snapshot.date}T00:00:00.000Z`,
            priceUsd: toFiniteNumber(asset?.priceUsd),
            change24hPct: toFiniteNumber(asset?.change24hPct),
            marketCapUsd: toFiniteNumber(asset?.marketCapUsd),
            fdvUsd: toFiniteNumber(asset?.fdvUsd),
            liquidityUsd: toFiniteNumber(asset?.liquidityUsd),
            volume24hUsd: toFiniteNumber(asset?.volume24hUsd),
            indexedPoolCount: toFiniteNumber(asset?.indexedPoolCount),
            deepestPool: asset?.deepestPool ?? null,
          };
        })
        .sort((left, right) => left.date.localeCompare(right.date));
      return {
        observations,
        priced: observations.filter(item => item.priceUsd !== null),
        latest: observations.at(-1) ?? null,
      };
    }

    function useCompactMarketLimit() {
      const query = '(max-width: 760px)';
      const [limit, setLimit] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia(query).matches ? 3 : 6
      ));
      useEffect(() => {
        const media = window.matchMedia(query);
        const update = () => setLimit(media.matches ? 3 : 6);
        update();
        media.addEventListener?.('change', update);
        return () => media.removeEventListener?.('change', update);
      }, []);
      return limit;
    }
    function useInView(rootMargin = '0px 0px 15% 0px') {
      const ref = useRef(null);
      const [inView, setInView] = useState(false);
      useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        if (typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) { setInView(true); io.disconnect(); }
        }, { rootMargin });
        io.observe(node);
        return () => io.disconnect();
      }, [rootMargin]);
      return [ref, inView];
    }
    function marketChangeClass(value) {
      const n = toFiniteNumber(value);
      if (n === null) return '';
      return n > 0 ? ' market__change--up' : n < 0 ? ' market__change--down' : ' market__change--flat';
    }

    // Verifier lookup helpers — same registry semantics exposed by
    // @zodiacs/sdk through isOfficialZodiacAddress() etc.
    const norm = (s) => (s || '').trim();
    const eq = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();
    const eqRegistryAddress = (representation, candidate) => (
      representation.chain === 'base'
        ? eq(representation.address, candidate)
        : norm(representation.address) === norm(candidate)
    );
    function lookupAddress(input) {
      const q = norm(input);
      if (!q) return null;
      for (const sign of SIGNS) {
        for (const representation of sign.asset.representations) {
          if (representation.address && eqRegistryAddress(representation, q)) {
            return { sign, network: representation.chain, representation };
          }
        }
      }
      return null;
    }
    function truncateAddress(a, lead = 6, tail = 4) {
      if (!a || a.length <= lead + tail + 2) return a || '';
      return `${a.slice(0, lead)}…${a.slice(-tail)}`;
    }

    const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

    // ──────────────────────────────────────────────────────────────
    // Sub-components
    // ──────────────────────────────────────────────────────────────

    // Phones: the navigation is a full-width bar at the top edge that slides
    // away as the page scrolls down (the wing pages' shared rule).
    const PHONE_BAR_QUERY = '(max-width: 599.5px)';

    function Header() {
      const [menuOpen, setMenuOpen] = useState(false);
      const [signsOpen, setSignsOpen] = useState(false);
      const [toolsOpen, setToolsOpen] = useState(false);
      const toolsButtonRef = useRef(null);
      const signsButtonRef = useRef(null);
      const focusDropdownItem = (id, last = false) => {
        window.requestAnimationFrame(() => {
          const items = [...document.querySelectorAll(`#${id} a`)];
          const target = items[last ? items.length - 1 : 0];
          items.forEach((item) => { item.tabIndex = item === target ? 0 : -1; });
          target?.focus();
        });
      };
      const handleDropdownKey = (event, columns, close, triggerRef) => {
        const item = event.target.closest('a');
        if (!item) return;
        const items = [...event.currentTarget.querySelectorAll('a')];
        const index = items.indexOf(item);
        const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
        let next = null;
        if (event.key in moves) next = (index + moves[event.key] + items.length) % items.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = items.length - 1;
        if (next !== null) {
          event.preventDefault();
          items.forEach((candidate, candidateIndex) => { candidate.tabIndex = candidateIndex === next ? 0 : -1; });
          items[next]?.focus();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          close(false);
          triggerRef.current?.focus();
        }
      };
      useEffect(() => {
        if (!menuOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('keydown', onKey);
        const prev = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = prev; };
      }, [menuOpen]);
      useEffect(() => {
        if (!signsOpen) return undefined;
        const onDoc = (e) => { if (!e.target.closest('.wnav-wrap')) setSignsOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setSignsOpen(false); };
        document.addEventListener('click', onDoc);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
      }, [signsOpen]);
      useEffect(() => {
        if (!toolsOpen) return undefined;
        const onDoc = (e) => { if (!e.target.closest('.wnav-wrap')) setToolsOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setToolsOpen(false); };
        document.addEventListener('click', onDoc);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
      }, [toolsOpen]);
      // On phones the bar slides away as the page scrolls down and returns as
      // it scrolls up. It always shows near the top, while a menu or sheet is
      // open, and while it holds keyboard focus.
      const wrapRef = useRef(null);
      const menusRef = useRef(false);
      menusRef.current = menuOpen || signsOpen || toolsOpen;
      useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return undefined;
        let phone = null;
        try {
          phone = window.matchMedia(PHONE_BAR_QUERY);
        } catch {
          return undefined;
        }
        const root = document.documentElement;
        let last = Math.max(0, window.scrollY);
        let away = false;
        let frame = 0;
        const set = (next) => {
          if (next === away) return;
          away = next;
          wrap.classList.toggle('is-away', next);
        };
        const held = () => menusRef.current
          || root.style.overflow === 'hidden'
          || root.classList.contains('has-campaign-sheet')
          || document.body.classList.contains('registry-trade-open')
          || !!wrap.querySelector(':focus-visible');
        const tick = () => {
          frame = 0;
          const y = Math.max(0, window.scrollY);
          if (!phone.matches || y < 64 || held()) {
            set(false);
            last = y;
            return;
          }
          if (Math.abs(y - last) < 8) return;
          set(y > last);
          last = y;
        };
        const onScroll = () => {
          if (!frame) frame = window.requestAnimationFrame(tick);
        };
        const onFocus = () => set(false);
        window.addEventListener('scroll', onScroll, { passive: true });
        phone.addEventListener?.('change', tick);
        wrap.addEventListener('focusin', onFocus);
        return () => {
          window.cancelAnimationFrame(frame);
          window.removeEventListener('scroll', onScroll);
          phone.removeEventListener?.('change', tick);
          wrap.removeEventListener('focusin', onFocus);
        };
      }, []);
      const NAV_SIGNS = [
        { slug: 'aries', name: 'Aries', glyph: '♈', dates: 'Mar 21 – Apr 19', hue: '#DE8E79' },
        { slug: 'taurus', name: 'Taurus', glyph: '♉', dates: 'Apr 20 – May 20', hue: '#B9D4BE' },
        { slug: 'gemini', name: 'Gemini', glyph: '♊', dates: 'May 21 – Jun 20', hue: '#B29DD0' },
        { slug: 'cancer', name: 'Cancer', glyph: '♋', dates: 'Jun 21 – Jul 22', hue: '#B6D4E4' },
        { slug: 'leo', name: 'Leo', glyph: '♌', dates: 'Jul 23 – Aug 22', hue: '#E0A9B4' },
        { slug: 'virgo', name: 'Virgo', glyph: '♍', dates: 'Aug 23 – Sep 22', hue: '#B7D9B0' },
        { slug: 'libra', name: 'Libra', glyph: '♎', dates: 'Sep 23 – Oct 22', hue: '#D3A9DE' },
        { slug: 'scorpio', name: 'Scorpio', glyph: '♏', dates: 'Oct 23 – Nov 21', hue: '#B9DCE8' },
        { slug: 'sagittarius', name: 'Sagittarius', glyph: '♐', dates: 'Nov 22 – Dec 21', hue: '#E0B080' },
        { slug: 'capricorn', name: 'Capricorn', glyph: '♑', dates: 'Dec 22 – Jan 19', hue: '#C0DEA8' },
        { slug: 'aquarius', name: 'Aquarius', glyph: '♒', dates: 'Jan 20 – Feb 18', hue: '#AE8FC9' },
        { slug: 'pisces', name: 'Pisces', glyph: '♓', dates: 'Feb 19 – Mar 20', hue: '#A9D4C4' },
      ];
      const NAV_TOOLS = [
        { href: '/birth-chart/', name: 'Birth chart', description: 'See your sun, moon, rising, planets, houses, and what they mean.' },
        { href: '/compatibility/', name: 'Compatibility', description: 'Compare two charts and see where they click, clash, and grow.' },
        { href: '/transits/', name: 'Transits', description: "See today's sky next to your chart." },
        { href: '/moon-sign/', name: 'Moon sign', description: 'How you feel, and what settles you.' },
        { href: '/rising-sign/', name: 'Rising sign', description: 'Find the sign people meet first. Birth time helps.' },
        { href: '/moon-phase/', name: 'Moon phase', description: 'Tonight’s moon, and the moon of any date you care about.' },
        { href: '/saturn-return/', name: 'Saturn return', description: 'When yours hits, exactly, and what it tends to ask.' },
        { href: '/birthday/', name: 'Birthday', description: 'Check the Zodiac sign for any birthday from 1940 to 2030, including birthdays close to a sign change.' },
      ];
      const terminalNav = {
        href: '/astrofolio/',
        label: 'Astrofolio',
        description: 'Choose a sign and explore the collection',
      };
      return (
        <>
          <div className="wnav-wrap" ref={wrapRef}>
            <nav className="wnav" aria-label="Primary" data-wnav="">
                <a className="wnav__mark" href="/">
                  <span className="wnav__name">Zodiacs<span className="wnav__sep">·</span><span className="wnav__dim">org</span></span>
                </a>
                <div className="wnav__links">
                  <button ref={toolsButtonRef} className="wnav__link wnav__dropdown-btn wnav__tools-btn" type="button" data-wnav-tools="" aria-expanded={toolsOpen} aria-controls="wnav-tools" aria-haspopup="true" onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSignsOpen(false); setToolsOpen(true); focusDropdownItem('wnav-tools', event.key === 'ArrowUp'); } }} onClick={() => { setToolsOpen((v) => !v); setSignsOpen(false); }}>Tools<svg width="8" height="5" viewBox="0 0 8 5" fill="none" aria-hidden="true"><path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                  <button ref={signsButtonRef} className="wnav__link wnav__dropdown-btn wnav__signs-btn" type="button" data-wnav-signs="" aria-expanded={signsOpen} aria-controls="wnav-signs" aria-haspopup="true" onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setToolsOpen(false); setSignsOpen(true); focusDropdownItem('wnav-signs', event.key === 'ArrowUp'); } }} onClick={() => { setSignsOpen((v) => !v); setToolsOpen(false); }}>Signs<svg width="8" height="5" viewBox="0 0 8 5" fill="none" aria-hidden="true"><path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                  <a className="wnav__link" href="/today/">Today</a>
                  <a className="wnav__link" href="/learn/">Learn</a>
                  <a className="wnav__link" href="/horoscopes/">Horoscopes</a>
                  <a className="wnav__link" href="/profile/">Saved charts</a>
                </div>
                <a className="wnav__search" href="/?search=1" aria-label="Search the site">
                  <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.75" stroke="currentColor" strokeWidth="1.4"/><path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  <kbd className="wnav__search-kbd" aria-hidden="true">/</kbd>
                </a>
                <a className="wnav__chip" href={terminalNav.href} aria-current={REGISTRY_VIEW === 'terminal' ? 'page' : undefined}>{terminalNav.label}</a>
                <button type="button" className="wnav__burger" data-wnav-burger="" aria-expanded={menuOpen} aria-controls="wnav-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => { setToolsOpen(false); setSignsOpen(false); setMenuOpen((v) => !v); }}>
                  <span className="wnav__burger-line" /><span className="wnav__burger-line" /><span className="wnav__burger-line" />
                </button>
            </nav>
            <div className={toolsOpen ? 'wnav-tools is-open' : 'wnav-tools'} id="wnav-tools" data-wnav-tools-menu="" hidden={!toolsOpen} onKeyDown={(event) => handleDropdownKey(event, 2, setToolsOpen, toolsButtonRef)}>
              <div className="wnav-tools__grid">
                {NAV_TOOLS.map((tool, index) => (
                  <a className="wnav-tools__item" key={tool.href} href={tool.href} tabIndex={index === 0 ? 0 : -1} onClick={() => setToolsOpen(false)}>
                    <span className="wnav-tools__name">{tool.name}</span>
                    <span className="wnav-tools__desc">{tool.description}</span>
                  </a>
                ))}
              </div>
            </div>
            <div className={signsOpen ? 'wnav-signs is-open' : 'wnav-signs'} id="wnav-signs" data-wnav-signs-menu="" hidden={!signsOpen} onKeyDown={(event) => handleDropdownKey(event, 3, setSignsOpen, signsButtonRef)}>
              <div className="wnav-signs__grid">
                {NAV_SIGNS.map((s, index) => (
                  <a className="wnav-signs__item" key={s.slug} href={`/${s.slug}/`} style={{ '--sign': s.hue }} tabIndex={index === 0 ? 0 : -1} onClick={() => setSignsOpen(false)}>
                    <picture className="wnav-disc"><source srcSet={`/assets/zodiac-icons/128/${s.slug}.avif`} type="image/avif" /><img src={`/assets/zodiac-icons/128/${s.slug}.webp`} width="32" height="32" alt="" loading="lazy" decoding="async" /></picture>
                    <span className="wnav-signs__name">{s.name}</span>
                    <span className="wnav-signs__dates">{s.dates}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div id="wnav-menu" className={menuOpen ? 'wnav-menu is-open' : 'wnav-menu'} data-wnav-mobile="" hidden={!menuOpen} onClick={(e) => { if (e.target.closest('a')) setMenuOpen(false); }}>
            <nav aria-label="Mobile">
              <div className="wnav-menu__group">
                <span className="wnav-menu__label">The site</span>
                <a className="wnav-menu__link" style={{ '--i': 0 }} href="/today/">Today</a>
                <a className="wnav-menu__link" style={{ '--i': 1 }} href="/learn/">Learn</a>
                <a className="wnav-menu__link" style={{ '--i': 2 }} href="/horoscopes/">Horoscopes</a>
                <a className="wnav-menu__link" style={{ '--i': 3 }} href="/profile/">Saved charts</a>
                <a className="wnav-menu__link wnav-menu__registry" style={{ '--i': 4 }} href={terminalNav.href} aria-current={REGISTRY_VIEW === 'terminal' ? 'page' : undefined}>
                  <span>{terminalNav.label}</span>
                  <small>{terminalNav.description}</small>
                </a>
              </div>
              <div className="wnav-menu__group">
                <span className="wnav-menu__label">Tools</span>
                <div className="wnav-menu__tools">
                  {NAV_TOOLS.map((tool, i) => (
                    <a className="wnav-menu__tool" key={tool.href} style={{ '--i': i }} href={tool.href} aria-label={`${tool.name}. ${tool.description}`}>{tool.name}</a>
                  ))}
                </div>
              </div>
              <div className="wnav-menu__group">
                <span className="wnav-menu__label">The twelve</span>
                <div className="wnav-menu__signs">
                  {NAV_SIGNS.map((s, i) => (
                    <a className="wnav-menu__sign" key={s.slug} style={{ '--i': i, '--sign': s.hue }} href={`/${s.slug}/`} aria-label={s.name}>
                      <picture className="wnav-disc wnav-disc--lg"><source srcSet={`/assets/zodiac-icons/128/${s.slug}.avif`} type="image/avif" /><img src={`/assets/zodiac-icons/128/${s.slug}.webp`} width="40" height="40" alt="" loading="lazy" decoding="async" /></picture>
                      <span>{s.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        </>
      );
    }
    function CopyChip({ text, display }) {
      const [copied, setCopied] = useState(false);
      const onCopy = useCallback(() => {
        if (!text) return;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }
      }, [text]);
      return (
        <button
          type="button"
          className={'copychip' + (copied ? ' is-copied' : '')}
          onClick={onCopy}
          aria-label={`${display || text}. Copy full address`}
          title={text}
        >
          <span className="copychip__text mono">{display || text}</span>
          <span className="copychip__icon" aria-hidden="true" />
        </button>
      );
    }

    /* The gallery band — the twelve Gold Sculptures as the hub's selector.
       Set before first paint by the head probe; constant for the page's
       life, so the strip and the band never both render. */
    const GALLERY_LIVE = document.documentElement.classList.contains('gallery-live');

    let galleryBundleRequested = false;

    /* The trade panel's runtime, fetched at most once per page and only when
       the panel is actually near the reader. Resolves to null if the bundle
       cannot load, so a failed fetch leaves an empty box rather than a
       half-built form. */
    let tradeBundleReady = null;

    function loadTradeBundle() {
      if (tradeBundleReady) return tradeBundleReady;
      tradeBundleReady = new Promise((resolve) => {
        if (window.zodiacsTrade) { resolve(window.zodiacsTrade); return; }
        const script = document.createElement('script');
        script.src = '/assets/trade.js';
        script.defer = true;
        script.addEventListener('load', () => resolve(window.zodiacsTrade ?? null), { once: true });
        script.addEventListener('error', () => resolve(null), { once: true });
        document.body.appendChild(script);
      });
      return tradeBundleReady;
    }

    /* The panel itself is plain DOM, mounted into this box by the bundle. It
       is rebuilt when the sign changes: a panel is about one token, and
       carrying a half-typed amount across signs would be worse than clearing
       it. */
    function LandingTrade({ sign }) {
      const hostRef = useRef(null);
      useEffect(() => {
        const host = hostRef.current;
        if (!host) return undefined;
        let panel = null;
        let live = true;
        let io = null;
        const open = () => {
          loadTradeBundle().then((trade) => {
            if (!live || !trade) return;
            panel = trade.mount(host, {
              name: sign.name,
              slug: sign.asset.sign,
              mint: sign.representations.solana.address,
              hue: sign.hue,
              iconUrl: `/assets/zodiac-icons/128/${sign.asset.sign}.webp`,
            });
          });
        };
        if (!('IntersectionObserver' in window)) open();
        else {
          io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { open(); io.disconnect(); }
          }, { rootMargin: '400px 0px' });
          io.observe(host);
        }
        return () => {
          live = false;
          io?.disconnect();
          panel?.destroy?.();
        };
      }, [sign]);

      return <div className="consumer-trade" data-landing-trade={sign.asset.sign} ref={hostRef} />;
    }

    // Inert pastel discs hold the rail's shape until the scene bundle
    // arrives and swaps in the live ticks with one replaceChildren call.
    // Rendered via dangerouslySetInnerHTML with a constant string so React
    // never reconciles the rail's children after the scene owns them.
    const RAIL_PLACEHOLDER_HTML = SIGNS.map((s) => (
      `<span class="rail__tick rail__tick--placeholder" style="--sign:${s.hue}" aria-hidden="true">`
      + '<picture>'
      + `<source srcset="/assets/zodiac-icons/48/${s.asset.sign}.avif" type="image/avif"/>`
      + `<img src="/assets/zodiac-icons/48/${s.asset.sign}.webp" width="26" height="26" alt="" loading="lazy" decoding="async"/>`
      + '</picture></span>'
    )).join('');

    /* A compact instrument for the sky the visitor is actually in. The gold
       artwork carries the season's identity; price stays in the selected market
       and selected-sign placard, so this readout only has to explain time. */
    function SeasonNow({ season }) {
      if (!season) return null;
      const { sign, day, total, remaining, ends } = season;
      const endLabel = ends.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      const remainingLabel = remaining === 0
        ? 'Final day'
        : `${remaining} day${remaining === 1 ? '' : 's'} remaining`;
      const progress = total > 0 ? Math.min(1, Math.max(0, day / total)) : 1;

      return (
        <aside
          className="season-now"
          style={{ '--season-sign': sign.hue, '--season-progress': progress }}
          data-season-current=""
          data-season-sign={sign.asset.sign}
          data-season-day={day}
          data-season-total={total}
          data-season-remaining={remaining}
          aria-label={`${sign.name} season. ${remainingLabel}. Ends ${endLabel}.`}
        >
          <span className="season-now__identity">
            <picture className="season-now__sculpture" aria-hidden="true" data-season-sculpture={sign.asset.sign}>
              <img
                src={`/assets/sculptures/512/${sign.asset.sign}.webp`}
                width="512"
                height="512"
                alt=""
                loading="eager"
                decoding="async"
              />
            </picture>
            <span className="season-now__copy">
              <span className="season-now__kicker">Now in season</span>
              <strong>{sign.name}</strong>
            </span>
          </span>
          <span className="season-now__countdown">
            <span className="season-now__kicker">Season closes</span>
            <strong>{remainingLabel}</strong>
            <span className="season-now__ends">Ends {endLabel}</span>
          </span>
          <span
            className="season-now__progress-block season-now__progress-pill"
            data-season-progress={progress.toFixed(4)}
          >
            <span className="season-now__kicker">Season progress</span>
            <span className="season-now__ends season-now__progress-value" aria-hidden="true">
              Day {day} of {total}
            </span>
            <span
              className="season-now__progress season-now__progress-track"
              role="progressbar"
              aria-label={`${sign.name} season progress`}
              aria-valuemin="1"
              aria-valuemax={total}
              aria-valuenow={day}
              aria-valuetext={`${remainingLabel}; day ${day} of ${total}`}
            >
              <span className="season-now__progress-fill" style={{ transform: `scaleX(${progress})` }} />
            </span>
          </span>
        </aside>
      );
    }

    /* The placard's price: one number and its day, small enough to sit on a
       museum label. Reads from the same single batched market call the rest
       of the page shares. */
    function PlacardQuote({ sign, batch }) {
      const quote = batch.status === 'ok' ? batch.quotes[sign.asset.sign] : null;
      const changeClass = marketChangeClass(quote?.priceChange24h);
      return (
        <span className="stage-placard__quote" aria-live="polite">
          {quote ? (
            <>
              <span className="stage-placard__price">{formatPriceUsd(quote.priceUsd)}</span>
              <span className={'stage-placard__change' + changeClass}>
                {plainMarketMovement(quote.priceChange24h)}
              </span>
            </>
          ) : (
            <span className="stage-placard__price stage-placard__price--waiting">
              {batch.status === 'ok' ? 'Price not indexed' : batch.status === 'unavailable' ? 'Live price unavailable' : 'Reading live price…'}
            </span>
          )}
        </span>
      );
    }

    let selectedTokenChartRuntimePromise = null;
    let selectedTokenChartClient = null;
    function loadSelectedTokenChartRuntime() {
      if (!selectedTokenChartRuntimePromise) {
        selectedTokenChartRuntimePromise = import('/assets/registry-token-chart.js')
          .then((module) => {
            selectedTokenChartClient ||= module.createSelectedTokenHistoryClient();
            return { module, client: selectedTokenChartClient };
          })
          .catch((error) => {
            selectedTokenChartRuntimePromise = null;
            throw error;
          });
      }
      return selectedTokenChartRuntimePromise;
    }

    function MarketHistoryChart({ observations, sign, compact = false }) {
      const available = Array.isArray(observations) ? observations : [];
      const pricedAvailable = available.filter(point => point.priceUsd !== null);
      const [range, setRange] = useState('all');
      const ranges = [
        { id: '7d', label: '7D', count: 7 },
        { id: '30d', label: '30D', count: 30 },
        { id: 'all', label: 'All', count: Infinity },
      ];
      useEffect(() => {
        const required = ranges.find(option => option.id === range)?.count ?? Infinity;
        if (Number.isFinite(required) && pricedAvailable.length < required) setRange('all');
      }, [pricedAvailable.length, range]);
      const selected = range === 'all'
        ? available
        : available.slice(-Number.parseInt(range, 10));
      const priced = selected.filter(point => point.priceUsd !== null);
      const width = compact ? 220 : 520;
      const height = compact ? 52 : 150;
      const inset = compact ? 3 : 8;
      const values = priced.map(point => point.priceUsd);
      const rawLow = values.length ? Math.min(...values) : 0;
      const rawHigh = values.length ? Math.max(...values) : 0;
      const rawSpread = rawHigh - rawLow || Math.max(Math.abs(rawHigh) * 0.04, 1e-12);
      const domainPadding = rawSpread * .12;
      const low = rawLow - domainPadding;
      const high = rawHigh + domainPadding;
      const spread = high - low;
      const xAt = (index) => inset + ((width - (2 * inset)) * (selected.length <= 1 ? .5 : index / (selected.length - 1)));
      const yAt = (value) => inset + ((height - (2 * inset)) * (1 - ((value - low) / spread)));
      const segments = [];
      let activeSegment = [];
      selected.forEach((point, index) => {
        const previous = selected[index - 1];
        const currentDay = Date.parse(`${point.date}T00:00:00Z`);
        const previousDay = previous ? Date.parse(`${previous.date}T00:00:00Z`) : currentDay;
        const calendarGap = index > 0
          && Number.isFinite(currentDay)
          && Number.isFinite(previousDay)
          && currentDay - previousDay !== 86_400_000;
        if (point.priceUsd === null || calendarGap) {
          if (activeSegment.length) segments.push(activeSegment);
          activeSegment = [];
          if (point.priceUsd === null) return;
        }
        activeSegment.push(`${xAt(index).toFixed(2)},${yAt(point.priceUsd).toFixed(2)}`);
      });
      if (activeSegment.length) segments.push(activeSegment);
      const first = priced[0];
      const last = priced.at(-1);
      const archiveChange = priced.length > 1 && first.priceUsd > 0
        ? ((last.priceUsd - first.priceUsd) / first.priceUsd) * 100
        : null;
      const observedElapsedMs = priced.length > 1
        ? Date.parse(last.observedAt || `${last.date}T00:00:00Z`)
          - Date.parse(first.observedAt || `${first.date}T00:00:00Z`)
        : 0;
      const observedElapsed = Number.isFinite(observedElapsedMs) && observedElapsedMs > 0
        ? observedElapsedMs < 48 * 60 * 60 * 1000
          ? `${Math.max(1, Math.round(observedElapsedMs / 3_600_000))}h apart`
          : `${Math.max(1, Math.round(observedElapsedMs / 86_400_000))}d apart`
        : '';
      const summary = priced.length === 0
        ? `${sign.name} archived price history is unavailable.`
        : priced.length === 1
          ? `${sign.name} has one archived daily price observation, ${formatPriceUsd(first.priceUsd)} on ${first.date}.`
          : `${sign.name} has ${priced.length} archived daily price observations, from ${formatPriceUsd(first.priceUsd)} on ${first.date} to ${formatPriceUsd(last.priceUsd)} on ${last.date}.`;

      return (
        <figure className={'registry-history' + (compact ? ' registry-history--compact' : '')}>
          <figcaption>
            <span>{priced.length} daily observation{priced.length === 1 ? '' : 's'}</span>
            {!compact && (
              <span className="registry-history__range" role="group" aria-label="Price-history range">
                {ranges.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={range === option.id}
                    disabled={Number.isFinite(option.count) && pricedAvailable.length < option.count}
                    onClick={() => setRange(option.id)}
                  >{option.label}</button>
                ))}
              </span>
            )}
          </figcaption>
          {compact && priced.length >= 2 && priced.length < 8 ? (
            <div className="registry-history__comparison" role="img" aria-label={summary}>
              <span><small>{first.date.slice(5)}</small><strong>{formatPriceUsd(first.priceUsd)}</strong></span>
              <span className={'registry-history__delta' + marketChangeClass(archiveChange)}>
                <strong>{formatPercent(archiveChange)}</strong>
                <small>{observedElapsed || `${priced.length} archived reads`}</small>
              </span>
              <span><small>{last.date.slice(5)}</small><strong>{formatPriceUsd(last.priceUsd)}</strong></span>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={summary}
            >
              <line x1={inset} x2={width - inset} y1={height - inset} y2={height - inset} className="registry-history__axis" />
              {segments.map((points, index) => points.length > 1 ? (
                <polyline key={index} points={points.join(' ')} className="registry-history__line" />
              ) : (
                <circle key={index} cx={points[0].split(',')[0]} cy={points[0].split(',')[1]} r={compact ? 2.5 : 4} className="registry-history__point" />
              ))}
            </svg>
          )}
          {priced.length < 2 && <p>{priced.length ? 'Archive building from this dated point.' : 'Archived price unavailable.'}</p>}
          {compact && priced.length >= 2 && priced.length < 8 && <p>Archive building · a line begins at 8 daily observations.</p>}
        </figure>
      );
    }

    function SelectedTokenMiniChart({ sign, pool, observations }) {
      const [hostRef, inView] = useInView('160px 0px 160px 0px');
      const [state, setState] = useState({ status: 'idle' });
      const token = sign.representations.solana?.address || '';

      useEffect(() => {
        if (!inView || !token) return undefined;
        let cancelled = false;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
          setState({ status: 'loading' });
          loadSelectedTokenChartRuntime()
            .then(async ({ module, client }) => {
              if (!pool) {
                return {
                  model: module.buildSelectedTokenChartModel({
                    token,
                    label: sign.name,
                    pool: null,
                    archiveObservations: observations,
                    live: { status: 'not_indexed', reason: 'no_pool' },
                  }),
                };
              }
              return client.load({
                token,
                pool,
                label: sign.name,
                archiveObservations: observations,
                signal: controller.signal,
              });
            })
            .then((result) => {
              if (!cancelled && result?.model) setState({ status: 'ready', model: result.model });
            })
            .catch((error) => {
              if (!cancelled && error?.name !== 'AbortError') setState({ status: 'fallback' });
            });
        }, 220);

        return () => {
          cancelled = true;
          window.clearTimeout(timer);
          controller.abort();
          selectedTokenChartClient?.cancel();
        };
      }, [inView, token, pool, sign.name, observations]);

      const model = state.status === 'ready' ? state.model : null;
      const width = 320;
      const height = 124;
      const insetX = 8;
      const priceTop = 8;
      const priceBottom = 91;
      const volumeTop = 101;
      const volumeBottom = 119;
      const linePoints = model?.points || [];
      const lows = linePoints
        .map(point => Number.isFinite(point.lowUsd) ? point.lowUsd : point.priceUsd)
        .filter(Number.isFinite);
      const highs = linePoints
        .map(point => Number.isFinite(point.highUsd) ? point.highUsd : point.priceUsd)
        .filter(Number.isFinite);
      const rawLow = lows.length ? Math.min(...lows) : 0;
      const rawHigh = highs.length ? Math.max(...highs) : 0;
      const rawSpread = rawHigh - rawLow || Math.max(Math.abs(rawHigh) * .04, 1e-12);
      const low = rawLow - rawSpread * .12;
      const high = rawHigh + rawSpread * .12;
      const spread = high - low;
      const startMs = Number.isFinite(model?.windowStartMs)
        ? model.windowStartMs
        : linePoints[0]?.slotMs;
      const endMs = Number.isFinite(model?.windowEndMs)
        ? model.windowEndMs
        : linePoints.at(-1)?.slotMs;
      const spanMs = Math.max(1, (endMs || 0) - (startMs || 0));
      const xAt = point => insetX + ((width - insetX * 2) * ((point.slotMs - startMs) / spanMs));
      const candleXAt = point => insetX + ((width - insetX * 2) * (
        (point.slotMs - startMs + ((model?.intervalMs || 0) / 2)) / spanMs
      ));
      const yAt = value => priceTop + ((priceBottom - priceTop) * (1 - ((value - low) / spread)));
      const segmentPoints = segment => segment
        .map(point => `${xAt(point).toFixed(2)},${yAt(point.priceUsd).toFixed(2)}`)
        .join(' ');
      const latest = linePoints.at(-1) || null;
      const lastActive = model?.lastActive || null;
      const isLiveCandles = model?.source === 'geckoterminal-hourly';
      const maxVolume = Math.max(0, ...linePoints.map(point => Number(point.volumeUsd) || 0));
      const slotWidth = ((width - insetX * 2) * ((model?.intervalMs || 1) / spanMs));
      const candleWidth = Math.max(2.8, Math.min(7, slotWidth * .54));
      const volumeHeight = value => maxVolume > 0
        ? Math.max(1.2, Math.sqrt(value / maxVolume) * (volumeBottom - volumeTop))
        : 0;
      const updated = latest
        ? new Date(latest.timestampMs).toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
          })
        : '';
      const formatChartHour = value => new Date(value).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
      });
      const timeTicks = Number.isFinite(startMs) && Number.isFinite(endMs)
        ? [startMs, startMs + spanMs / 2, endMs].map(formatChartHour)
        : ['−24H', 'UTC', 'Now'];
      const activeHour = lastActive
        ? `${formatChartHour(lastActive.slotMs)}–${formatChartHour(lastActive.slotMs + (model?.intervalMs || 0))} UTC`
        : 'No active hour';
      const endpointMoment = (point) => {
        if (!point) return '';
        if (model?.timeframe === '1d' && point.date) return point.date;
        return new Date(point.timestampMs).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
        }) + ' UTC';
      };
      const elapsedMs = Number.isFinite(model?.startTimestampMs) && Number.isFinite(model?.endTimestampMs)
        ? Math.max(0, model.endTimestampMs - model.startTimestampMs)
        : 0;
      const elapsedLabel = elapsedMs < 60 * 60 * 1000
        ? `${Math.max(1, Math.round(elapsedMs / 60_000))}m elapsed`
        : elapsedMs < 48 * 60 * 60 * 1000
          ? `${Math.max(1, Math.round(elapsedMs / 3_600_000))}h elapsed`
          : `${Math.max(1, Math.round((elapsedMs / 86_400_000) * 10) / 10)}d elapsed`;

      return (
        <div ref={hostRef} className="selected-token-chart" data-token-chart={sign.asset.sign}>
          {(state.status === 'idle' || state.status === 'loading') && (
            <figure className="token-spark token-spark--loading" aria-label={`${sign.name} 24-hour price chart loading`} aria-busy="true">
              <figcaption><span>24H price</span><span>Loading</span></figcaption>
              <span className="token-spark__skeleton" aria-hidden="true" />
            </figure>
          )}
          {state.status === 'fallback' && <MarketHistoryChart observations={observations} sign={sign} compact />}
          {model && model.mode === 'line' && (
            <figure className={'token-spark ' + (model.source === 'geckoterminal-hourly' ? 'token-spark--live' : 'token-spark--archive')}>
              <figcaption>
                <span className="token-spark__identity">
                  <strong>{model.source === 'geckoterminal-hourly' ? `${sign.name.toUpperCase()} / USD · 24H` : 'Registry archive'}</strong>
                  <small>{model.source === 'geckoterminal-hourly' ? 'Reference pool · GeckoTerminal · UTC' : 'Daily closes'}</small>
                </span>
                <span className="token-spark__close">
                  <small>{model.source === 'geckoterminal-hourly' ? '24H close' : 'Change'}</small>
                  <strong className={marketChangeClass(model.netChangePct)}>{formatPercent(model.netChangePct)}</strong>
                </span>
              </figcaption>
              <div className="token-spark__plot">
                <div className="token-spark__canvas">
                  <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={model.ariaLabel}>
                    {[.25, .5, .75].map(fraction => (
                      <line
                        key={fraction}
                        x1={insetX}
                        x2={width - insetX}
                        y1={priceTop + ((priceBottom - priceTop) * fraction)}
                        y2={priceTop + ((priceBottom - priceTop) * fraction)}
                        className="token-spark__grid"
                      />
                    ))}
                    <line x1={width / 2} x2={width / 2} y1={priceTop} y2={volumeBottom} className="token-spark__grid token-spark__grid--vertical" />
                    <line x1={insetX} x2={width - insetX} y1={priceBottom} y2={priceBottom} className="token-spark__axis" />
                    <line x1={insetX} x2={insetX} y1={priceTop} y2={volumeBottom} className="token-spark__axis" />
                    {isLiveCandles && <line x1={insetX} x2={width - insetX} y1={volumeTop - 4} y2={volumeTop - 4} className="token-spark__volume-rule" />}
                    {latest && (
                      <line
                        x1={insetX}
                        x2={width - insetX}
                        y1={yAt(latest.closeUsd ?? latest.priceUsd).toFixed(2)}
                        y2={yAt(latest.closeUsd ?? latest.priceUsd).toFixed(2)}
                        className="token-spark__latest-guide"
                      />
                    )}
                    {isLiveCandles ? linePoints.map((point) => {
                      const x = candleXAt(point);
                      const openY = yAt(point.openUsd);
                      const closeY = yAt(point.closeUsd);
                      const bodyY = Math.min(openY, closeY);
                      const bodyHeight = Math.max(2, Math.abs(closeY - openY));
                      const direction = Math.abs(point.closeUsd - point.openUsd) < 1e-15
                        ? 'flat'
                        : point.closeUsd > point.openUsd ? 'up' : 'down';
                      const barHeight = point.hasTrades ? volumeHeight(point.volumeUsd) : 0;
                      return point.hasTrades ? (
                        <g key={point.slotMs} className={`token-spark__candle token-spark__candle--${direction}`}>
                          <line
                            x1={x.toFixed(2)}
                            x2={x.toFixed(2)}
                            y1={yAt(point.highUsd).toFixed(2)}
                            y2={yAt(point.lowUsd).toFixed(2)}
                            className="token-spark__wick"
                          />
                          <rect
                            x={(x - candleWidth / 2).toFixed(2)}
                            y={bodyY.toFixed(2)}
                            width={candleWidth.toFixed(2)}
                            height={bodyHeight.toFixed(2)}
                            rx=".7"
                            className="token-spark__body"
                          />
                          <rect
                            x={(x - Math.max(1.4, candleWidth * .32)).toFixed(2)}
                            y={(volumeBottom - barHeight).toFixed(2)}
                            width={Math.max(2.8, candleWidth * .64).toFixed(2)}
                            height={barHeight.toFixed(2)}
                            rx=".5"
                            className="token-spark__volume"
                          />
                        </g>
                      ) : (
                        <line
                          key={point.slotMs}
                          x1={(x - candleWidth * .42).toFixed(2)}
                          x2={(x + candleWidth * .42).toFixed(2)}
                          y1={yAt(point.closeUsd).toFixed(2)}
                          y2={yAt(point.closeUsd).toFixed(2)}
                          className={`token-spark__idle token-spark__idle--${point.idleKind || 'provider'}`}
                        />
                      );
                    }) : (
                      <>
                        {model.segments.map((segment, index) => segment.length > 1 ? (
                          <polyline key={`${segment[0].slotMs}-${index}`} points={segmentPoints(segment)} className="token-spark__line" />
                        ) : null)}
                        {linePoints.map(point => (
                          <circle
                            key={point.slotMs}
                            cx={xAt(point).toFixed(2)}
                            cy={yAt(point.priceUsd).toFixed(2)}
                            r="1.65"
                            className="token-spark__point"
                          />
                        ))}
                      </>
                    )}
                    {latest && (
                      <>
                        <circle cx={(isLiveCandles ? candleXAt(latest) : xAt(latest)).toFixed(2)} cy={yAt(latest.closeUsd ?? latest.priceUsd).toFixed(2)} r="4.4" className="token-spark__latest-ring" />
                        <circle cx={(isLiveCandles ? candleXAt(latest) : xAt(latest)).toFixed(2)} cy={yAt(latest.closeUsd ?? latest.priceUsd).toFixed(2)} r="2.35" className="token-spark__latest" />
                      </>
                    )}
                  </svg>
                </div>
                <span className="token-spark__price-scale" aria-hidden="true">
                  <span>{formatPriceUsd(rawHigh)}</span>
                  <span>{formatPriceUsd((rawHigh + rawLow) / 2)}</span>
                  <span>{formatPriceUsd(rawLow)}</span>
                </span>
                <span className="token-spark__time-scale" aria-hidden="true">
                  <span>{timeTicks[0]}</span><span>{timeTicks[1]}</span><span>{timeTicks[2]}</span>
                </span>
              </div>
              {isLiveCandles ? (
                <p>
                  {model.coverage.activePointCount} active hour{model.coverage.activePointCount === 1 ? '' : 's'}
                  {' · '}{model.coverage.idlePointCount} no-swap hour{model.coverage.idlePointCount === 1 ? ' carries' : 's carry'} last close
                  {' · '}latest active {activeHour}
                </p>
              ) : (
                <p>
                  {model.coverage.observedPointCount} of {model.coverage.expectedPointCount} daily closes
                  {model.coverage.missingPointCount > 0 && ` · ${model.coverage.missingPointCount} day${model.coverage.missingPointCount === 1 ? '' : 's'} missing`}
                  {updated && ` · updated ${updated} UTC`}
                </p>
              )}
            </figure>
          )}
          {model && model.mode !== 'line' && (
            <figure className="token-spark token-spark--comparison">
              <figcaption>
                <span>{model.timeframe === '1h' ? 'Hourly endpoints' : 'Archive'}</span>
                <span className={marketChangeClass(model.netChangePct)}>{formatPercent(model.netChangePct)}</span>
              </figcaption>
              {model.mode === 'empty' ? (
                <p role="status">Price history unavailable.</p>
              ) : model.mode === 'single' ? (
                <div className="token-spark__single" role="img" aria-label={model.ariaLabel}>
                  <strong>{formatPriceUsd(model.first.priceUsd)}</strong>
                  <small>{endpointMoment(model.first)} · one observation</small>
                </div>
              ) : (
                <div className="registry-history__comparison" role="img" aria-label={model.ariaLabel}>
                  <span><small>{model.timeframe === '1h' ? 'First open' : 'First'}</small><strong>{formatPriceUsd(model.startPriceUsd)}</strong></span>
                  <span className={'registry-history__delta' + marketChangeClass(model.netChangePct)}>
                    <strong>{formatPercent(model.netChangePct)}</strong>
                    <small>
                      {model.timeframe === '1h'
                        ? `${model.coverage.activePointCount} active · ${model.coverage.idlePointCount} no-swap`
                        : `${model.coverage.observedPointCount} reads`}
                      {' · '}{elapsedLabel}
                    </small>
                  </span>
                  <span><small>{model.timeframe === '1h' ? 'Latest close' : 'Latest'}</small><strong>{formatPriceUsd(model.endPriceUsd)}</strong></span>
                </div>
              )}
              <p>{model.source === 'geckoterminal-hourly' ? 'Hourly history building · chart begins at 8 hourly slots.' : 'Registry archive fallback · line begins at 8 reads.'}</p>
            </figure>
          )}
        </div>
      );
    }

    function PlacardMarketPanel({ sign }) {
      const batch = useTwelveQuotes(true);
      const history = useRegistryMarketHistory(true);
      const quote = batch.status === 'ok' ? batch.quotes[sign.asset.sign] : null;
      const ledger = useMemo(
        () => marketHistoryForSign(history.data, sign.asset.sign),
        [history.data, sign.asset.sign],
      );
      const observations = ledger.observations;
      const latest = ledger.latest;
      const marketCapRows = batch.status === 'ok'
        ? SIGNS.map(item => ({ item, value: toFiniteNumber(batch.quotes[item.asset.sign]?.marketCap) }))
          .filter(row => row.value !== null)
          .sort((a, b) => b.value - a.value || a.item.order - b.item.order)
        : [];
      const liquidityRows = batch.status === 'ok'
        ? SIGNS.map(item => ({ item, value: toFiniteNumber(batch.quotes[item.asset.sign]?.liquidityUsd) }))
          .filter(row => row.value !== null)
          .sort((a, b) => b.value - a.value || a.item.order - b.item.order)
        : [];
      const capRank = marketCapRows.findIndex(row => row.item.ticker === sign.ticker);
      const liquidityRank = liquidityRows.findIndex(row => row.item.ticker === sign.ticker);
      const liveChartUrl = quote?.url || latest?.deepestPool?.url || '';
      const marketCap = toFiniteNumber(quote?.marketCap) ?? latest?.marketCapUsd ?? null;
      const liquidity = toFiniteNumber(quote?.liquidityUsd) ?? latest?.liquidityUsd ?? null;
      const volume = toFiniteNumber(quote?.volume24h) ?? latest?.volume24hUsd ?? null;
      const pools = toFiniteNumber(quote?.poolCount) ?? latest?.indexedPoolCount ?? null;
      const chartPool = quote?.pairAddress || latest?.deepestPool?.pairAddress || '';

      return (
        <div className="stage-market" data-stage-market={sign.asset.sign}>
          <div className="stage-market__chart">
            <SelectedTokenMiniChart
              key={sign.asset.sign}
              sign={sign}
              pool={chartPool}
              observations={observations}
            />
          </div>
          <dl className="stage-market__facts">
            <div><dt>Reported market cap{capRank >= 0 ? ` · #${capRank + 1}` : ''}</dt><dd>{marketCap === null ? '—' : formatUsdCompact(marketCap)}</dd></div>
            <div><dt>Liquidity{liquidityRank >= 0 ? ` · #${liquidityRank + 1}` : ''}</dt><dd>{liquidity === null ? '—' : formatUsdCompact(liquidity)}</dd></div>
            <div><dt>24h volume</dt><dd>{volume === null ? '—' : formatUsdCompact(volume)}</dd></div>
            <div><dt>Pools</dt><dd>{pools === null ? '—' : pools}</dd></div>
          </dl>
          {liveChartUrl && (
            <a className="stage-market__live" href={liveChartUrl} rel="noopener noreferrer external nofollow">
              Open live chart <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      );
    }

    function StageConstellation({ slug }) {
      const currentSlug = useRef(slug);
      const [layers, setLayers] = useState({ current: slug, previous: null });
      useEffect(() => {
        if (currentSlug.current === slug) return undefined;
        const previous = currentSlug.current;
        currentSlug.current = slug;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          setLayers({ current: slug, previous: null });
          return undefined;
        }
        setLayers({ current: slug, previous });
        const timer = window.setTimeout(() => {
          setLayers(current => current.current === slug
            ? { current: slug, previous: null }
            : current);
        }, 320);
        return () => window.clearTimeout(timer);
      }, [slug]);
      return (
        <picture className="gband__constellation" aria-hidden="true" data-stage-constellation={slug}>
          {layers.previous && (
            <img
              className="is-leaving"
              src={`/assets/constellations/${layers.previous}.svg`}
              alt=""
              decoding="async"
            />
          )}
          <img
            className="is-entering"
            src={`/assets/constellations/${layers.current}.svg`}
            alt=""
            decoding="async"
          />
        </picture>
      );
    }

    /* The twelve pastel discs as a rail rather than a grid: the same picker
       at every width, scrolling sideways where it cannot fit. Keyboard
       contract matches the grid it replaces — roving tabindex, arrows walk
       the row, Home and End jump to the ends. */
    function DiscRail({ active, setActive }) {
      const railRef = useRef(null);
      const activeIndex = Math.max(0, SIGNS.findIndex(item => item.ticker === active));

      const choose = (index, focus = false) => {
        const wrapped = ((index % SIGNS.length) + SIGNS.length) % SIGNS.length;
        const next = SIGNS[wrapped];
        if (!next) return;
        if (focus) {
          railRef.current
            ?.querySelector(`[data-consumer-sign="${next.asset.sign}"]`)
            ?.focus({ preventScroll: true });
        }
        setActive(next.ticker);
        trackAnalytics('registry_sign_selected', { sign: next.asset.sign, source: 'consumer_explorer' });
      };

      const onKeyDown = (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const moves = {
          ArrowRight: activeIndex + 1,
          ArrowLeft: activeIndex - 1,
          Home: 0,
          End: SIGNS.length - 1
        };
        if (!(event.key in moves)) return;
        event.preventDefault();
        choose(moves[event.key], true);
      };

      // Keep the chosen disc in view when the rail is wider than the plate.
      useEffect(() => {
        const disc = railRef.current?.querySelector('[aria-pressed="true"]');
        disc?.scrollIntoView({ inline: 'center', block: 'nearest' });
      }, [active]);

      return (
        <div
          className="rail"
          ref={railRef}
          role="group"
          aria-label="Choose a Zodiac sign"
          onKeyDown={onKeyDown}
        >
          {SIGNS.map((item) => {
            const isActive = item.ticker === active;
            return (
              <button
                key={item.ticker}
                id={item.asset.sign}
                type="button"
                className={'rail__tick' + (isActive ? ' is-active' : '')}
                data-consumer-sign={item.asset.sign}
                aria-label={`${item.name}, ${signDateLabel(item)}`}
                aria-pressed={isActive}
                aria-controls="consumer-sign-preview"
                tabIndex={isActive ? 0 : -1}
                style={{ '--sign': item.hue }}
                onClick={() => choose(item.order - 1)}
              >
                <picture aria-hidden="true">
                  <source srcSet={`/assets/zodiac-icons/48/${item.asset.sign}.avif`} type="image/avif" />
                  <img
                    src={`/assets/zodiac-icons/48/${item.asset.sign}.webp`}
                    width="26"
                    height="26"
                    alt=""
                    loading={item.order > 6 ? 'lazy' : 'eager'}
                    decoding="async"
                  />
                </picture>
              </button>
            );
          })}
        </div>
      );
    }

    /* Phones get one sculpture in one bounded room. The disc rail remains the
       explicit selector; a horizontal swipe simply moves to the adjacent
       sign. Keeping only the active render in the stage removes the ghosted
       twelve-slide overlap and makes artwork, label and selected disc change
       in the same React paint. */
    function SculptureCarousel({ active, setActive }) {
      const activeIndex = Math.max(0, SIGNS.findIndex(item => item.ticker === active));
      const item = SIGNS[activeIndex];
      const previousIndex = useRef(activeIndex);
      const drag = useRef(null);
      const presentation = SCULPTURE_PRESENTATION[item.asset.sign] || { scale: 1, translateY: '0%' };
      let step = activeIndex - previousIndex.current;
      if (Math.abs(step) > 1) step = 0;
      const entryX = step === 0 ? '0px' : `${Math.sign(step) * 12}px`;

      useEffect(() => {
        previousIndex.current = activeIndex;
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
        const before = SIGNS[(activeIndex - 1 + SIGNS.length) % SIGNS.length];
        const after = SIGNS[(activeIndex + 1) % SIGNS.length];
        for (const neighbour of [before, after]) {
          const image = new Image();
          image.src = `/assets/sculptures/512/${neighbour.asset.sign}.webp`;
        }
      }, [activeIndex]);

      const onPointerDown = (event) => {
        if (drag.current) return;
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      };
      const finishSwipe = (event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        drag.current = null;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const elapsed = Math.max(1, event.timeStamp - start.time);
        const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
        const intentional = Math.abs(dx) >= 42 || Math.abs(dx / elapsed) > 0.11;
        if (!horizontal || !intentional) return;
        const direction = dx < 0 ? 1 : -1;
        const next = (activeIndex + direction + SIGNS.length) % SIGNS.length;
        setActive(SIGNS[next].ticker);
      };
      const cancelSwipe = () => { drag.current = null; };

      return (
        <div
          className="stage-carousel"
          data-gallery-carousel=""
          aria-label={`${item.name} Zodiac artwork. Swipe horizontally to browse signs.`}
          onPointerDown={onPointerDown}
          onPointerUp={finishSwipe}
          onPointerCancel={cancelSwipe}
          onLostPointerCapture={cancelSwipe}
        >
          <div className="stage-carousel__track">
            <div
              key={item.ticker}
              className="stage-carousel__slide is-active"
              style={{
                '--slide-sign': item.hue,
                '--art-scale': presentation.scale,
                '--art-y': presentation.translateY,
                '--art-entry-x': entryX,
              }}
            >
              <div className="stage-carousel__figure" data-carousel-art={item.asset.sign}>
                <img
                  className="stage-carousel__art"
                  src={`/assets/sculptures/512/${item.asset.sign}.webp`}
                  width="512"
                  height="512"
                  alt={`${item.name} Zodiac artwork`}
                  loading="eager"
                  decoding="async"
                />
                <span className="stage-carousel__plinth" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    function GalleryBand({
      active,
      setActive,
      consumer = false,
      carousel = false,
      identityOnly = false,
      marketBatch = { status: 'idle' },
    }) {
      const stageRef = useRef(null);
      // The slug the scene last announced — the guard that keeps the
      // selection loop (scene → state → scene) from echoing.
      const gallerySlug = useRef(null);
      const sign = SIGNS.find(s => s.ticker === active) ?? SIGNS[0];
      const slug = sign.asset.sign;
      const activeSlugRef = useRef(slug);
      activeSlugRef.current = slug;
      const [posterSlug, setPosterSlug] = useState(slug);
      const season = useCurrentSeason();
      const tradingEnabled = consumer && !identityOnly && REGISTRY_TRADE_ENABLED;
      // The trade sheet: the panel slides in over the stage on request and
      // the sculpture stays where it is, dimmed behind the scrim. Closing
      // returns focus to the pill that opened it.
      const [sheetState, setSheetState] = useState('closed');
      // The scene owns WebGL readiness; React owns the section class list.
      // Keep the two in one explicit state contract so breakpoint renders do
      // not erase an imperative class added by the long-lived scene.
      const [galleryReady, setGalleryReady] = useState(false);
      const sheetVisible = sheetState !== 'closed';
      const sheetCloseTimer = useRef(0);
      const tradePillRef = useRef(null);
      const sheetCloseRef = useRef(null);
      const sheetPanelRef = useRef(null);
      const closeSheet = useCallback(() => {
        setSheetState(current => current === 'closed' ? current : 'closing');
        window.clearTimeout(sheetCloseTimer.current);
        sheetCloseTimer.current = window.setTimeout(() => setSheetState('closed'), 210);
      }, []);

      useEffect(() => () => window.clearTimeout(sheetCloseTimer.current), []);

      useEffect(() => {
        if (!sheetVisible) return undefined;
        sheetCloseRef.current?.focus({ preventScroll: true });
        const panel = sheetPanelRef.current;
        const scrollY = window.scrollY;
        const body = document.body;
        const previousBody = {
          position: body.style.position,
          top: body.style.top,
          width: body.style.width,
          overflow: body.style.overflow,
        };
        const inertSiblings = [...body.children]
          .filter(node => node !== panel?.parentElement && node instanceof HTMLElement)
          .map(node => ({ node, inert: node.inert, ariaHidden: node.getAttribute('aria-hidden') }));
        for (const entry of inertSiblings) {
          entry.node.inert = true;
          entry.node.setAttribute('aria-hidden', 'true');
        }
        body.style.position = 'fixed';
        body.style.top = `${-scrollY}px`;
        body.style.width = '100%';
        body.style.overflow = 'hidden';
        body.classList.add('registry-trade-open');

        const focusable = () => [...(panel?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || [])].filter(node => (
          !node.hidden
          && node.getAttribute('aria-hidden') !== 'true'
          && node.getClientRects().length > 0
        ));
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeSheet();
            return;
          }
          if (event.key !== 'Tab') return;
          const items = focusable();
          if (!items.length) {
            event.preventDefault();
            panel?.focus();
            return;
          }
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('keydown', onKey);
          for (const entry of inertSiblings) {
            entry.node.inert = entry.inert;
            if (entry.ariaHidden == null) entry.node.removeAttribute('aria-hidden');
            else entry.node.setAttribute('aria-hidden', entry.ariaHidden);
          }
          body.style.position = previousBody.position;
          body.style.top = previousBody.top;
          body.style.width = previousBody.width;
          body.style.overflow = previousBody.overflow;
          body.classList.remove('registry-trade-open');
          window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
          tradePillRef.current?.focus({ preventScroll: true });
        };
      }, [sheetVisible, closeSheet]);

      /* What choosing a sculpture means. Flag-on it opens the trade where the
         reader already is; flag-off it opens the sign's record, so the piece
         is never inert. */
      const openTrade = () => {
        if (tradingEnabled) {
          window.clearTimeout(sheetCloseTimer.current);
          setSheetState('open');
        }
        else window.location.href = registryProfilePath(sign);
      };

      useEffect(() => {
        const node = stageRef.current;
        if (!node) return undefined;
        const onReady = () => setGalleryReady(true);
        const onUnready = () => {
          setPosterSlug(activeSlugRef.current);
          setGalleryReady(false);
        };
        node.addEventListener('zodiacs:gallery-ready', onReady);
        node.addEventListener('zodiacs:gallery-unready', onUnready);
        // Covers a cached scene that became ready before this effect attached.
        if (node.classList.contains('is-ready')
          && node.querySelector('[data-gallery-canvas] canvas')) onReady();
        return () => {
          node.removeEventListener('zodiacs:gallery-ready', onReady);
          node.removeEventListener('zodiacs:gallery-unready', onUnready);
        };
      }, []);

      useEffect(() => {
        if (!galleryReady) setPosterSlug(slug);
      }, [galleryReady, slug]);

      // The scene bundle carries Three.js; it is fetched only as the band
      // approaches the viewport, and only once. The carousel never asks.
      useEffect(() => {
        const node = stageRef.current;
        if (!node || carousel) return undefined;
        const inject = () => {
          if (galleryBundleRequested) return;
          galleryBundleRequested = true;
          const script = document.createElement('script');
          script.src = '/assets/gallery.js';
          script.defer = true;
          document.body.appendChild(script);
        };
        if (!('IntersectionObserver' in window)) { inject(); return undefined; }
        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) { inject(); io.disconnect(); }
        }, { rootMargin: '400px 0px' });
        io.observe(node);
        return () => io.disconnect();
      }, [carousel]);

      // Scene → page: walking the row selects the sign everywhere below.
      useEffect(() => {
        const node = stageRef.current;
        if (!node || carousel) return undefined;
        const onSign = (event) => {
          const next = event?.detail?.slug;
          if (!next) return;
          gallerySlug.current = next;
          const match = SIGNS.find(s => s.asset.sign === next);
          if (match) setActive(match.ticker);
        };
        node.addEventListener('zodiacs:gallery-sign', onSign);
        return () => node.removeEventListener('zodiacs:gallery-sign', onSign);
      }, [carousel, setActive]);

      // Page → scene: any other selector turns the row to match.
      useEffect(() => {
        const node = stageRef.current;
        if (!node || carousel || gallerySlug.current === slug) return;
        node.dispatchEvent(new CustomEvent('zodiacs:gallery-focus', { detail: { slug } }));
      }, [slug, carousel]);

      // A purchase sheet visually owns the stage. Pause the decorative
      // turntable while it is open, then resume when the sculpture is visible
      // again; direct rotation state remains inside the scene bundle.
      useEffect(() => {
        const node = stageRef.current;
        if (!node) return;
        node.dispatchEvent(new CustomEvent(
          carousel || sheetVisible ? 'zodiacs:gallery-pause' : 'zodiacs:gallery-resume'
        ));
      }, [carousel, sheetVisible]);

      const railGroup = (
        <div
          className="rail"
          data-gallery-rail=""
          data-gallery-desktop-rail=""
          role="group"
          aria-label="Choose a Zodiac sign"
          hidden={consumer && carousel}
          dangerouslySetInnerHTML={{ __html: RAIL_PLACEHOLDER_HTML }}
        />
      );

      return (
        <>
          <section
            ref={stageRef}
            id="gallery"
            className={'gband'
              + (consumer ? ' gband--consumer' : '')
              + (carousel ? ' gband--flat' : '')
              + (!carousel && galleryReady ? ' is-ready' : '')}
            aria-label="Interactive Zodiac sign gallery"
            data-gallery-stage={carousel ? undefined : ''}
            data-gallery-embed={carousel ? undefined : ''}
            data-gallery-initial={slug}
            data-gallery-spotlight={consumer && !carousel ? '' : undefined}
            data-gallery-paused={consumer && (carousel || sheetVisible) ? '' : undefined}
          >
          {consumer && !identityOnly && <StageConstellation slug={slug} />}
          {/* The stage picks with the rail at the top and shows one piece
              large below it, so the twelve read as the choice and the chosen
              sculpture as the answer. The rail deliberately does NOT wear
              .gband__chrome: the scene measures the band it may fill by that
              element's offsetTop, and chrome above the canvas would leave it
              nothing. */}
          {consumer && !identityOnly && (
            <SeasonNow season={season} />
          )}
          {consumer && (
            <div className="gband__rail-top">
              {/* Keep the scene-owned rail node alive while the mobile picker
                  is showing. The gallery bundle replaces its placeholders
                  once and keeps those interactive buttons across every
                  desktop → mobile → desktop cycle. */}
              {railGroup}
              {carousel && <DiscRail active={active} setActive={setActive} />}
            </div>
          )}
          {!carousel && (
            <picture className="gband__poster" aria-hidden="true">
              <img
                src={`/assets/sculptures/512/${posterSlug}.webp`}
                width="512"
                height="512"
                alt=""
                decoding="async"
              />
            </picture>
          )}
          <div className="gband__mount" data-gallery-canvas="" hidden={carousel} />
          {consumer && !carousel && (
            <p className="gband__turn-hint" data-gallery-turn-hint="" aria-hidden="true">
              <span className="gband__turn-mark">↔</span>
              <span>Drag the figure to turn · drag the room to browse</span>
            </p>
          )}
          {carousel && <SculptureCarousel active={active} setActive={setActive} />}
          <p className="gband__name" data-gallery-name="" aria-hidden="true" />
          {consumer && (
            <div
              id="consumer-sign-preview"
              className="stage-placard"
              data-consumer-preview={slug}
              aria-labelledby="stage-placard-name"
            >
              <span className="stage-placard__who">
                <span id="stage-placard-name" className="stage-placard__name">{sign.name}</span>
                <span className="stage-placard__meta">
                  <span className="stage-placard__dates">{signDateLabel(sign)}</span>
                  <PlacardQuote sign={sign} batch={marketBatch} />
                </span>
              </span>
              {identityOnly && (
                <span className="stage-placard__identity">
                  <span>Official {sign.name} token</span>
                  <strong>Your sign, current price and rank. No sign-in required.</strong>
                </span>
              )}
              {!identityOnly && <PlacardMarketPanel sign={sign} />}
              <span className="stage-placard__actions">
                {identityOnly ? (
                  <a className="btn btn--primary stage-placard__pill" href="#registry">
                    <span>About {sign.name}</span>
                  </a>
                ) : tradingEnabled ? (
                  <button
                    ref={tradePillRef}
                    type="button"
                    className="btn btn--primary stage-placard__pill"
                    onClick={openTrade}
                  >
                    <span>Buy {sign.name}</span>
                  </button>
                ) : (
                  <a className="btn btn--primary stage-placard__pill" href={registryProfilePath(sign)}>
                    <span>View {sign.name}</span>
                  </a>
                )}
                <a className="btn btn--ghost stage-placard__pill" href={`${registryProfilePath(sign)}#record`}>
                  <span>Check the token</span>
                </a>
              </span>
            </div>
          )}
          {/* Portalled to the body: the sheet must stand above the floating
              nav, and everything inside main sits in a lower stacking
              context than the nav does. */}
          {tradingEnabled && sheetVisible && ReactDOM.createPortal(
            <div
              className="stage-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="stage-sheet-title"
              data-state={sheetState}
              style={{ '--active-sign': sign.hue }}
            >
              <div className="stage-sheet__scrim" onClick={closeSheet} aria-hidden="true" />
              <div ref={sheetPanelRef} className="stage-sheet__panel" tabIndex="-1">
                <header className="stage-sheet__head">
                  <span className="stage-sheet__handle" aria-hidden="true" />
                  <h2 id="stage-sheet-title" className="sr-only">Acquisition Desk — buy {sign.name}</h2>
                  <button
                    ref={sheetCloseRef}
                    type="button"
                    className="stage-sheet__close"
                    onClick={closeSheet}
                    aria-label="Close the Acquisition Desk"
                  >✕</button>
                </header>
                {/* The panel introduces itself — disc, name, and the venue it
                    trades through — so repeating the record above it would
                    push the thing the reader opened below the fold. */}
                <div className="stage-sheet__body">
                  <LandingTrade sign={sign} />
                  <a className="stage-sheet__record" href={registryProfilePath(sign)}>
                    The full record <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            </div>,
            document.body,
          )}
          {!consumer && (
          <div className="gband__chrome">
            {railGroup}
            <button className="gband__open" type="button" data-gallery-open="">
              View {sign.name}
            </button>
            <p className="gband__hint" data-gallery-hint="">
              Drag to browse · Choose a sign to open.
            </p>
          </div>
          )}

          <aside className="gcard" data-gallery-card="" hidden aria-labelledby="gcard-name" aria-live="off">
            <button className="card__close" type="button" data-gallery-close="" aria-label="Return to the twelve signs">✕</button>
            <p className="card__lot" data-card-lot="" />
            <h2 className="card__name" id="gcard-name" data-card-name="" />
            <p className="card__figure" data-card-figure="" />

            {!identityOnly && <div className="card__market" hidden={consumer}>
              <p className="card__market-state" data-market-state="">Loading market context.</p>
              <div className="card__price" data-market-price-row="" hidden>
                <span className="card__price-value" data-market-price="" />
                <span className="card__price-change" data-market-change="" />
              </div>
              <div className="card__cta" data-market-cta="" hidden>
                <a className="card__buy" data-market-jupiter="" rel="noopener noreferrer external nofollow">
                  <span>Open Jupiter route</span><span aria-hidden="true">↗</span>
                </a>
                <a className="card__data" data-market-dexscreener="" rel="noopener noreferrer external nofollow">
                  <span>View market data</span><span aria-hidden="true">↗</span>
                </a>
              </div>
              <dl className="card__market-grid" data-market-grid="" hidden />
              <p className="card__risk">
                Independent third-party data, not a valuation or recommendation.
                It may be delayed or unavailable; prices and liquidity can
                change quickly, and a Zodiac can lose all market value. The
                route above opens an independent third-party venue; this
                Registry page does not request custody, signing, approvals, or
                transactions. Operator and economic-interest statements remain
                pending confirmation; see the <a href="/disclosure/">Disclosure</a>.
              </p>
            </div>}

            <dl className="card__facts" data-card-facts="" />
            <div className="card__records" data-card-records="" />
            <a className="card__entry" data-card-entry="" href="/registry/">
              <span>Open catalogue entry</span><span aria-hidden="true">→</span>
            </a>
          </aside>

          <p className="sr-only" role="status" aria-live="polite" data-gallery-live="" />
          </section>
        </>
      );
    }

    /* Verifier — the most strategically important section on the page.
       Real working JS against the embedded SIGNS array. Three states:
       found-base, found-solana, not-found. Neutral copy for unknowns. */
    function VerifierSection() {
      const reveal = useReveal();
      const [input, setInput] = useState('');
      const [result, setResult] = useState(null);
      const onSubmit = (e) => {
        e.preventDefault();
        const query = norm(input);
        const chain = /^0x[0-9a-f]{40}$/i.test(query)
          ? 'base'
          : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query) ? 'solana' : 'invalid';
        if (chain === 'invalid') {
          trackAnalytics('verifier_used', { chain, outcome: 'invalid' });
          setResult({ state: 'invalid', queried: query });
          return;
        }
        const hit = lookupAddress(query);
        trackAnalytics('verifier_used', { chain, outcome: hit ? 'official' : 'not_found' });
        if (!hit) {
          setResult({ state: 'not-found', queried: query });
          return;
        }
        setResult({ state: 'official', sign: hit.sign, network: hit.network, queried: query });
      };
      const onClear = () => { setInput(''); setResult(null); };
      const examples = ['LEO', 'CANCER', 'PISCES'].map(t => SIGNS.find(s => s.ticker === t));
      const networkLabel = result?.network === 'base' ? 'Base' : 'Solana';

      return (
        <section ref={reveal} id="verify" className="sec consumer-verify reveal" aria-labelledby="verify-title">
          <div className="consumer-section-head">
            <span className="consumer-section-head__eyebrow">A quick safety check</span>
            <h2 id="verify-title">Check if a token is official.</h2>
          </div>
          <p className="consumer-verify__intro">
            Copy the token address from your wallet or the site where you found it, then paste it here.
            We&rsquo;ll compare it with the official list. Never paste a seed phrase or recovery phrase.
          </p>
          <p className="consumer-verify__distinction">
            This checks a Zodiac&rsquo;s token address, not your public wallet address.
          </p>

          <form className="vrf" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="vrf-input">Zodiac mint or contract address</label>
            <input
              id="vrf-input"
              className="vrf__input mono"
              type="text"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              placeholder="Paste token address"
              value={input}
              onChange={e => {
                setInput(e.target.value);
                if (result) setResult(null);
              }}
            />
            <button type="submit" className="vrf__submit">Check address</button>
          </form>

          <div className="vrf__examples">
            <span className="label label--mute">Try an official example</span>
            {examples.map(s => (
              <button
                key={s.ticker}
                type="button"
                className="vrf__example"
                onClick={() => setInput(s.representations.base.address)}
              >
                {s.name}
              </button>
            ))}
            {input && (
              <button type="button" className="vrf__example vrf__example--clear" onClick={onClear}>
                Clear
              </button>
            )}
          </div>

          {result && (
            <div
              className={'vrf__result vrf__result--' + result.state}
              role="status"
              aria-live="polite"
              data-verifier-state={result.state}
            >
              {result.state === 'official' && (
                <>
                  <div className="vrf__result-head">
                    <span className="vrf__tick" aria-hidden="true">✓</span>
                    <span>{`Official ${result.sign.name} address on ${networkLabel}.`}</span>
                  </div>
                  <VrfResultBody sign={result.sign} network={result.network} queried={result.queried} />
                </>
              )}
              {result.state === 'not-found' && (
                <>
                  <div className="vrf__result-head">
                    <span className="vrf__cross" aria-hidden="true">×</span>
                    <span>{'This address isn’t in the official Zodiac list.'}</span>
                  </div>
                  <div className="vrf__result-meta mono">{truncateAddress(result.queried, 10, 8) || '—'}</div>
                </>
              )}
              {result.state === 'invalid' && (
                <div className="vrf__result-head">
                  <span className="vrf__cross" aria-hidden="true">×</span>
                  <span>{'That doesn’t look like a Solana or Base address.'}</span>
                </div>
              )}
            </div>
          )}

          <p className="consumer-verify__safety">
            Read-only: this checker never connects a wallet, requests a signature, or starts a transaction.
          </p>
        </section>
      );
    }

    function VrfResultBody({ sign, network, queried }) {
      return (
        <div className="vrf__result-body">
          <div className="vrf__result-sign">
            <img
              className="vrf__result-icon"
              src={`/assets/zodiac-icons/48/${sign.asset.sign}.webp`}
              alt=""
              width="40"
              height="40"
              decoding="async"
            />
            <div>
              <div className="vrf__result-name">{sign.name}</div>
              <div className="vrf__result-meta">
                <span className="mono">{sign.ticker}</span>
                <span className="dot" />
                <span>{sign.element}</span>
                <span className="dot" />
                <span>{sign.modality}</span>
                <span className="dot" />
                <span>{sign.rulingPlanet}</span>
              </div>
            </div>
          </div>
          <dl className="vrf__result-rows">
            <div className="detail__row">
              <dt className="k">Found on</dt>
              <dd className="v">{network === 'base' ? 'Base' : 'Solana'}</dd>
            </div>
            <div className="detail__row">
              <dt className="k">Address</dt>
              <dd className="v"><CopyChip text={queried} display={truncateAddress(queried, 8, 6)} /></dd>
            </div>
            <div className="detail__row">
              <dt className="k">{network === 'base' ? 'Original Solana record' : 'Base counterpart'}</dt>
              <dd className="v">
                {network === 'base'
                  ? (sign.representations.solana.address
                      ? <CopyChip text={sign.representations.solana.address} display={truncateAddress(sign.representations.solana.address, 4, 4)} />
                      : <span className="card__addr-pending">Forthcoming</span>)
                  : <CopyChip text={sign.representations.base.address} display={truncateAddress(sign.representations.base.address, 6, 4)} />}
              </dd>
            </div>
          </dl>
        </div>
      );
    }

    function useMarketContext(sign, enabled) {
      const signKey = sign?.asset?.sign;
      const fallbackMint = sign?.representations?.solana?.address || null;
      const pinned = signKey ? ZODIAC_MARKET_PAIRS[signKey] : null;
      const config = pinned && fallbackMint
        ? { ...pinned, baseMint: fallbackMint }
        : fallbackMint ? { tokenMint: fallbackMint } : null;
      const [state, setState] = useState(
        config ? { status: 'idle' } : unavailableMarketContext('not-configured')
      );

      useEffect(() => {
        let cancelled = false;
        if (!config) {
          setState(unavailableMarketContext('not-configured'));
          return () => { cancelled = true; };
        }
        // Defer the third-party request until the panel is actually in
        // view. Autoplay rotates the featured sign, and we don't want to
        // fan out a fetch for every sign before the reader scrolls here.
        if (!enabled) {
          setState({ status: 'idle' });
          return () => { cancelled = true; };
        }

        setState({ status: 'loading' });
        loadMarketContext(config).then((result) => {
          if (!cancelled) setState(result);
        });

        return () => { cancelled = true; };
      }, [signKey, enabled]);

      return { config, state };
    }

    /* ── The Pulse — attention instrument ─────────────────────────
       Measured layer: Wikipedia pageviews for the twelve sign articles,
       fetched from the open Wikimedia API (snapshot in /assets/pulse.json,
       refreshed live in the visitor's browser). Search layer: Google
       Trends snapshot + link-out. Platform layer: editorial estimates,
       footnoted as approximations. Lazy-loaded; unavailable-safe. */
    const WIKI_SIGN_ARTICLES = SIGNS.map(s => `${s.name}_(astrology)`);

    function formatCompact(n) {
      if (n == null || !isFinite(n)) return '—';
      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
      return String(Math.round(n));
    }

    function pulseDateRange() {
      const end = new Date(Date.now() - 24 * 3600 * 1000);
      const start = new Date(end.getTime() - 29 * 24 * 3600 * 1000);
      const ymd = (d) => d.toISOString().slice(0, 10).replaceAll('-', '');
      return [ymd(start), ymd(end)];
    }

    function fetchLiveTwelve() {
      const [start, end] = pulseDateRange();
      const cacheKey = 'zd-pulse-live-' + end;
      try {
        const hit = sessionStorage.getItem(cacheKey);
        if (hit) return Promise.resolve(JSON.parse(hit));
      } catch (e) { /* storage unavailable */ }
      return Promise.all(
        WIKI_SIGN_ARTICLES.map(a =>
          fetch(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(a)}/daily/${start}/${end}`)
            .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        )
      ).then(results => {
        const byDate = new Map();
        for (const j of results) {
          for (const item of (j.items ?? [])) {
            const d = item.timestamp.slice(0, 8);
            byDate.set(d, (byDate.get(d) ?? 0) + item.views);
          }
        }
        const series = [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
        if (!series.length) throw new Error('empty');
        const avg = Math.round(series.reduce((s, v) => s + v, 0) / series.length);
        const out = { avgDay: avg, lastDay: series[series.length - 1], series };
        try { sessionStorage.setItem(cacheKey, JSON.stringify(out)); } catch (e) { /* ignore */ }
        return out;
      });
    }

    function Sparkline({ series }) {
      if (!series || series.length < 2) return null;
      const w = 320, h = 56, pad = 4;
      const min = Math.min(...series), max = Math.max(...series);
      const span = Math.max(max - min, 1);
      const pts = series.map((v, i) => {
        const x = pad + (i / (series.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / span) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return (
        <svg className="pulse__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="30-day attention sparkline">
          <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>
      );
    }

    function PulseSection() {
      const reveal = useReveal();
      const hostRef = useRef(null);
      const [enabled, setEnabled] = useState(false);
      const [pulse, setPulse] = useState(null);   // snapshot JSON
      const [live, setLive] = useState(null);     // live Wikipedia refresh
      const [failed, setFailed] = useState(false);

      useEffect(() => {
        const el = hostRef.current;
        if (!el || enabled) return undefined;
        if (!('IntersectionObserver' in window)) { setEnabled(true); return undefined; }
        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) { setEnabled(true); io.disconnect(); }
        }, { rootMargin: '240px 0px' });
        io.observe(el);
        return () => io.disconnect();
      }, [enabled]);

      useEffect(() => {
        if (!enabled) return;
        fetch('/assets/pulse.json')
          .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
          .then(setPulse)
          .catch(() => setFailed(true));
        fetchLiveTwelve().then(setLive).catch(() => { /* snapshot remains */ });
      }, [enabled]);

      const wiki = pulse?.wikipedia;
      const avgDay = live?.avgDay ?? wiki?.twelveAvgDay;
      const series = live?.series ?? wiki?.series?.map(d => d.views);
      const sourceLabel = live
        ? 'Source: Wikimedia · live'
        : (wiki ? `Source: Wikimedia · captured ${pulse.capturedAt}` : '');
      const trends = pulse?.trends;
      const trendsMax = trends ? Math.max(...trends.averages, 1) : 1;

      return (
        <section ref={reveal} id="pulse" className="sec reveal" aria-label="The Pulse">
          <div className="sec__head">
            <span className="sec__no">Nº 05</span>
            <span className="line" />
            <h2 className="sec__title">The Pulse</h2>
          </div>

          <h3 className="pulse__statement">
            Attention is the <span className="it">oldest currency.</span>
          </h3>
          <p className="sec__lede">
            The Twelve are read, tagged, and searched every day at a scale
            most tokens never touch. Measured where measurement is open;
            estimated — and labeled — where it is not.
          </p>

          <div ref={hostRef} className="pulse" aria-busy={enabled && !pulse && !failed}>
            {failed && !pulse && (
              <div className="pulse__state">Attention data unavailable — the argument stands in the <a href="/thesis/">thesis</a>.</div>
            )}

            {wiki && (
              <>
                <div className="pulse__head">
                  <span className="label label--gold">Reading the Twelve</span>
                  <span className="pulse__src">{sourceLabel}{live ? <span className="pulse__dot" aria-hidden="true" /> : null}</span>
                </div>
                <div className="pulse__grid">
                  <div className="pulse__cell pulse__cell--wide">
                    <div className="pulse__k">Encyclopedia reads · all twelve signs</div>
                    <div className="pulse__v">{formatCompact(avgDay)}<span className="pulse__unit"> / day</span></div>
                    {series ? <Sparkline series={series} /> : null}
                    <div className="pulse__sub">Trailing 30 days · en.wikipedia</div>
                  </div>
                  {(wiki.comparisons ?? []).map(c => (
                    <div className="pulse__cell" key={c.label}>
                      <div className="pulse__k">vs {c.label}</div>
                      <div className="pulse__v pulse__v--x">{c.multiple}×</div>
                      <div className="pulse__sub">{formatCompact(c.avgDay)} / day · single article</div>
                    </div>
                  ))}
                </div>

                {wiki.perSignAvgDay && (wiki.comparisons ?? []).length > 0 && (() => {
                  const rows = SIGNS
                    .map(s => ({ name: s.name, slug: s.asset.sign, v: wiki.perSignAvgDay[s.asset.sign] }))
                    .filter(r => Number.isFinite(r.v));
                  if (!rows.length) return null;
                  const strongest = wiki.comparisons.reduce((a, b) => (b.avgDay > a.avgDay ? b : a));
                  const maxSign = Math.max(...rows.map(r => r.v));
                  const weakest = Math.min(...rows.map(r => r.v));
                  const sorted = rows.map(r => r.v).sort((a, b) => a - b);
                  const median = sorted[Math.floor(sorted.length / 2)];
                  const ratio = weakest / Math.max(strongest.avgDay, 1);
                  const tickPct = Math.min((strongest.avgDay / maxSign) * 100, 100);
                  return (
                    <div className="pulse__block">
                      <div className="pulse__head">
                        <span className="label label--gold">One sign at a time</span>
                        <span className="pulse__src">Wikimedia · single articles, same window</span>
                      </div>
                      <p className="pulse__claim">
                        {ratio > 1
                          ? `No aggregation needed: every sign, alone, out-reads every token article. The quietest sign runs ${ratio.toFixed(1)}× the strongest token.`
                          : `One on one: the median sign reads at ${(median / Math.max(strongest.avgDay, 1)).toFixed(1)}× the strongest token article.`}
                      </p>
                      <div className="pulse__bars">
                        {rows.map(r => (
                          <div className="pulse__bar" key={r.name}>
                            <span className="pulse__bar-k pulse__bar-k--sign">
                              <span className="pulse__bar-name">{r.name}</span>
                              <img
                                className="pulse__bar-icon"
                                src={`/assets/zodiac-icons/48/${r.slug}.webp`}
                                width="14"
                                height="14"
                                alt=""
                                loading="lazy"
                                decoding="async"
                              />
                            </span>
                            <span className="pulse__bar-track">
                              <span
                                className="pulse__bar-fill is-twelve"
                                style={{ width: Math.max((r.v / maxSign) * 100, 2) + '%' }}
                              />
                              <span className="pulse__bar-tick" style={{ left: tickPct + '%' }} aria-hidden="true" />
                            </span>
                            <span className="pulse__bar-v">{formatCompact(r.v)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="pulse__note">
                        Reads per day, one disambiguated article per sign.
                        Gold line: the strongest token article in the same
                        window ({strongest.label}, {formatCompact(strongest.avgDay)} / day).
                        Token articles: {wiki.comparisons.map(c => `${c.label} ${formatCompact(c.avgDay)}`).join(' · ')}.
                      </p>
                    </div>
                  );
                })()}
              </>
            )}

            {trends && (
              <div className="pulse__block">
                <div className="pulse__head">
                  <span className="label label--gold">Searching the sky</span>
                  <span className="pulse__src">Source: Google Trends · captured {trends.capturedAt} · 12mo relative</span>
                </div>
                <div className="pulse__bars">
                  {trends.terms.map((t, i) => (
                    <div className="pulse__bar" key={t}>
                      <span className="pulse__bar-k">“{t}”</span>
                      <span className="pulse__bar-track">
                        <span
                          className={'pulse__bar-fill' + (i === 0 ? ' is-twelve' : '')}
                          style={{ width: Math.max((trends.averages[i] / trendsMax) * 100, 2) + '%' }}
                        />
                      </span>
                      <span className="pulse__bar-v">{trends.averages[i]}</span>
                    </div>
                  ))}
                </div>
                <a
                  className="pulse__out"
                  href={`https://trends.google.com/trends/explore?date=today%2012-m&q=${encodeURIComponent(trends.terms.join(','))}`}
                  rel="noopener noreferrer"
                >
                  Open the live comparison <span aria-hidden="true">↗</span>
                </a>
              </div>
            )}

            {pulse?.trendsSigns?.values && (() => {
              const ts = pulse.trendsSigns;
              const rows = SIGNS
                .map(s => ({ name: s.name, slug: s.asset.sign, v: ts.values[s.asset.sign] }))
                .filter(r => Number.isFinite(r.v));
              if (!rows.length) return null;
              const max = Math.max(...rows.map(r => r.v), 1);
              const tickPct = Math.min((1 / max) * 100, 100);
              return (
                <div className="pulse__block">
                  <div className="pulse__head">
                    <span className="label label--gold">Searching, sign by sign</span>
                    <span className="pulse__src">Google Trends · captured {ts.capturedAt} · “{ts.anchor}” = 1</span>
                  </div>
                  <div className="pulse__bars pulse__bars--terms">
                    {rows.map(r => (
                      <div className="pulse__bar" key={r.slug}>
                        <span className="pulse__bar-k">“{r.slug} horoscope”</span>
                        <span className="pulse__bar-track">
                          <span
                            className="pulse__bar-fill is-twelve"
                            style={{ width: Math.max((r.v / max) * 100, 2) + '%' }}
                          />
                          <span className="pulse__bar-tick" style={{ left: tickPct + '%' }} aria-hidden="true" />
                        </span>
                        <span className="pulse__bar-v">{r.v.toFixed(1)}×</span>
                      </div>
                    ))}
                  </div>
                  <p className="pulse__note">
                    Bare sign terms are ambiguous in English (cancer the
                    disease, gemini the model), so each bar measures the
                    explicit query, an undercount by design. Gold line:
                    “{ts.anchor}” search interest over the same twelve
                    months, set to 1.
                  </p>
                </div>
              );
            })()}

            {pulse?.estimates && (
              <div className="pulse__block">
                <div className="pulse__head">
                  <span className="label label--gold">Across the feeds · editorial estimates</span>
                  <span className="pulse__src">Estimates · {pulse.estimates.capturedAt}</span>
                </div>
                <p className="pulse__note pulse__note--lead">
                  Platform figures are editorial estimates from public
                  cumulative hashtag and search-volume data — directional,
                  not measured. Encyclopedia figures are measured.
                </p>
                <div className="pulse__grid pulse__grid--est">
                  {pulse.estimates.items.map(it => (
                    <div className="pulse__cell" key={it.k}>
                      <div className="pulse__k">{it.k} <span className="pulse__est">est.</span></div>
                      <div className="pulse__v">{it.v}</div>
                      <div className="pulse__sub">{it.unit}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <a className="pulse__more" href="/thesis/#pulse">
            <span>The full instrument — inside the thesis</span>
            <span className="pulse__more-arr" aria-hidden="true">→</span>
          </a>
        </section>
      );
    }

    // ---- Nº 06 · Market snapshot --------------------------------------------
    // Twelve lots in zodiac order. Two labeled layers, same honesty
    // contract as the Pulse: live DexScreener reads, and a weekly on-chain
    // distribution snapshot committed to the repository
    // (assets/distribution.json, refreshed by a scheduled action).
    function StandingsSection() {
      const reveal = useReveal();
      const hostRef = useRef(null);
      const [enabled, setEnabled] = useState(false);
      const [rows, setRows] = useState(null);
      const [failed, setFailed] = useState(false);
      const [dist, setDist] = useState(null);

      useEffect(() => {
        const el = hostRef.current;
        if (!el || enabled) return undefined;
        if (!('IntersectionObserver' in window)) { setEnabled(true); return undefined; }
        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) { setEnabled(true); io.disconnect(); }
        }, { rootMargin: '240px 0px' });
        io.observe(el);
        return () => io.disconnect();
      }, [enabled]);

      useEffect(() => {
        if (!enabled) return;
        loadTwelveMarketQuotes()
          .then((result) => {
            if (result.status !== 'ok') throw new Error(result.reason || 'unavailable');
            setRows(SIGNS.map((s) => {
              const quote = result.quotes?.[s.asset.sign] || null;
              return {
                sign: s,
                priceUsd: quote?.priceUsd ?? null,
                change24h: quote?.priceChange24h ?? null,
                marketCap: toNonNegativeNumber(quote?.marketCap)
              };
            }));
          })
          .catch(() => setFailed(true));
        fetch('/assets/distribution.json')
          .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
          .then(setDist)
          .catch(() => { /* the leaderboard stands without the snapshot */ });
      }, [enabled]);

      const marketRows = rows;
      const distFor = (slug) => dist?.signs?.[slug] || null;
      const distCapturedAt = (entry) => entry?.capturedAt || dist?.capturedAt || null;
      const distDates = dist
        ? [...new Set(Object.values(dist.signs || {})
          .map((entry) => distCapturedAt(entry)?.slice(0, 10))
          .filter(Boolean))].sort()
        : [];
      const distDateLabel = distDates.length === 1
        ? distDates[0]
        : distDates.length > 1
          ? `${distDates[0]}–${distDates[distDates.length - 1]}`
          : null;
      const pctShare = (value) => {
        const n = toFiniteNumber(value);
        return n === null
          ? '—'
          : `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
      };

      return (
        <section ref={reveal} id="standings" className="sec reveal" aria-label="Market snapshot">
          <div className="sec__head">
            <span className="sec__no">Nº 06</span>
            <span className="line" />
            <h2 className="sec__title">Market snapshot</h2>
          </div>

          <h3 className="standings__statement">
            Shown in zodiac order. <span className="it">Markets fluctuate.</span>
          </h3>
          <p className="sec__lede">
            Twelve public records, observed across open markets. Prices are read
            live from DexScreener; token-account concentration is read from the
            chain and snapshotted weekly. Rows always follow zodiac order; the
            figures are context—not a measure of quality, safety, or a
            recommendation. Digital assets are speculative, may become illiquid,
            and can lose all market value. Operator and economic-interest
            statements remain pending confirmation; see the{' '}
            <a href="/disclosure/">Disclosure</a>.
          </p>

          <div ref={hostRef} className="standings" aria-busy={enabled && !marketRows && !failed}>
            {!marketRows && !failed && (
              <div className="standings__state">Reading the market…</div>
            )}
            {failed && !marketRows && (
              <div className="standings__state">
                Market data unavailable. The records stand in the <a href="#registry">registry</a>.
              </div>
            )}
            {marketRows && (
              <>
                <div className="standings__src">
                  Source: DexScreener · live
                  {distDateLabel ? ` · token-account snapshots ${distDateLabel}` : ''}
                </div>
                <div className="standings__scroll">
                  <table className="standings__table">
                    <thead>
                      <tr>
                        <th scope="col">Lot</th>
                        <th className="standings__th--r" scope="col">Price USD</th>
                        <th className="standings__th--r" scope="col">24H</th>
                        <th className="standings__th--r" scope="col">Reported market cap</th>
                        <th className="standings__th--r" scope="col">Top-10 share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketRows.map((row) => {
                        const slug = row.sign.asset.sign;
                        const d = distFor(slug);
                        const change = toFiniteNumber(row.change24h);
                        const changeClass = change === null
                          ? ''
                          : change > 0
                            ? ' market__change--up'
                            : change < 0
                              ? ' market__change--down'
                              : ' market__change--flat';
                        return (
                          <tr key={row.sign.ticker}>
                            <td className="standings__lot">
                              <a href={`/registry/${slug}/`}>
                                <picture className="standings__disc" aria-hidden="true">
                                  <source srcSet={`/assets/zodiac-icons/48/${slug}.avif`} type="image/avif" />
                                  <img
                                    src={`/assets/zodiac-icons/48/${slug}.webp`}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    width="22"
                                    height="22"
                                  />
                                </picture>
                                <span className="standings__name">{row.sign.name}</span>
                                <span className="standings__tick">{row.sign.ticker}</span>
                              </a>
                            </td>
                            {row.marketCap === null && row.priceUsd === null ? (
                              <td className="standings__v standings__v--dim" colSpan="3">
                                Not indexed. The record stands regardless.
                              </td>
                            ) : (
                              <>
                                <td className="standings__v standings__v--mono">{formatPriceUsd(row.priceUsd)}</td>
                                <td className={`standings__v standings__v--mono${changeClass}`}>{formatPercent(row.change24h)}</td>
                                <td className="standings__v">{formatUsdCompact(row.marketCap)}</td>
                              </>
                            )}
                            <td
                              className="standings__v standings__v--mono"
                              title={distCapturedAt(d) ? `Snapshot ${distCapturedAt(d).slice(0, 10)}` : undefined}
                            >{pctShare(d?.top10Pct)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="standings__note">
                  Rows remain in zodiac order. Market figures are read live and
                  may be delayed, incomplete, or wrong. Top-10 share is the
                  portion of on-chain supply held by the ten largest token
                  accounts, read from the Solana RPC. Each sign keeps its own
                  observation date in the public snapshot. Token accounts are
                  not verified people or unique wallet owners: one owner may
                  use several accounts, and an account may represent a pool,
                  bridge, exchange, or custodian.
                </p>
              </>
            )}
          </div>
        </section>
      );
    }

    // ---- Shelf viewer (read-only public lookup) ----------------------------
    // Reads native Solana holdings through the same minimized, same-origin
    // endpoint as Registry Collection. The browser never sends an address directly
    // to a public RPC or requests unrelated token accounts.
    const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const ZODIAC_SOLANA_MINTS = new Map(
      SIGNS
        .filter((s) => s.representations.solana && s.representations.solana.address)
        .map((s) => [s.representations.solana.address, s])
    );
    const SHELF_CACHE = new Map();
    const ZODIAC_BY_SLUG = new Map(SIGNS.map((sign) => [sign.asset.sign, sign]));

    function shortAddress(value) {
      const s = String(value || '');
      return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
    }

    async function fetchShelfHoldings(owner) {
      if (SHELF_CACHE.has(owner)) return SHELF_CACHE.get(owner);
      const request = (async () => {
        const res = await fetch('/api/aura-holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: owner })
        });
        const payload = await res.json().catch(() => null);
        if (res.status === 429) {
          const err = new Error('rate-limited');
          err.kind = 'rate';
          throw err;
        }
        if (!res.ok) {
          const err = new Error(`Shelf lookup failed (${res.status})`);
          if (payload?.error === 'invalid_address') err.kind = 'invalid';
          throw err;
        }
        if (payload?.chain !== 'solana'
          || !Array.isArray(payload.heldSigns)
          || !Number.isFinite(Date.parse(payload.checkedAt))) {
          throw new Error('Incomplete Shelf response');
        }
        const held = [];
        const seen = new Set();
        for (const slug of payload.heldSigns) {
          const sign = typeof slug === 'string' ? ZODIAC_BY_SLUG.get(slug) : null;
          if (!sign || seen.has(slug)) throw new Error('Incomplete Shelf response');
          seen.add(slug);
          held.push({ sign });
        }
        const canonical = [...held].sort((a, b) => a.sign.order - b.sign.order);
        if (canonical.some((entry, index) => entry !== held[index])) {
          throw new Error('Incomplete Shelf response');
        }
        return canonical;
      })();
      SHELF_CACHE.set(owner, request);
      try {
        return await request;
      } catch (err) {
        SHELF_CACHE.delete(owner);
        throw err;
      }
    }

    function shelfComposition(held) {
      const counts = new Map();
      for (const h of held) {
        counts.set(h.sign.element, (counts.get(h.sign.element) || 0) + 1);
      }
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      if (ranked.length === 1) return `${ranked[0][0]} only`;
      if (ranked.length === 4 && ranked[0][1] === ranked[3][1]) return 'All four elements, balanced';
      return `${ranked[0][0]} and ${ranked[1][0].toLowerCase()} dominant`;
    }

    const SHELF_EXAMPLE_FACTS = [
      { k: 'Shelf', v: '4 illustrative Registry signs' },
      { k: 'Composition', v: 'Fire and water dominant' },
      { k: 'Season', v: 'Current season represented' },
      { k: 'Provenance', v: 'Native on Solana · bridged to Base' }
    ];

    function ShelfViewer() {
      const [input, setInput] = useState('');
      const [view, setView] = useState({ state: 'idle' });
      const lookupSeq = useRef(0);
      const season = useMemo(() => currentSeason(), []);

      const onSubmit = async (e) => {
        e.preventDefault();
        const address = input.trim();
        if (!address || view.state === 'loading') return;
        if (ZODIAC_SOLANA_MINTS.has(address) || lookupAddress(address)) {
          setView({ state: 'mint-hint' });
          return;
        }
        if (!SOLANA_ADDRESS_RE.test(address)) {
          setView({ state: 'invalid' });
          return;
        }
        const seq = ++lookupSeq.current;
        setView({ state: 'loading' });
        try {
          const held = await fetchShelfHoldings(address);
          if (seq !== lookupSeq.current) return;
          setView(held.length
            ? { state: 'holds', address, held }
            : { state: 'empty', address });
        } catch (err) {
          if (seq !== lookupSeq.current) return;
          if (err.kind === 'invalid') setView({ state: 'invalid' });
          else if (err.kind === 'rate') setView({ state: 'rate' });
          else setView({ state: 'error' });
        }
      };

      const onClear = () => {
        lookupSeq.current += 1;
        setInput('');
        setView({ state: 'idle' });
      };

      const live = view.state === 'holds' || view.state === 'empty';
      const loading = view.state === 'loading';

      const hint = {
        invalid: 'Not a valid Solana address.',
        'mint-hint': null, // rendered with a link below
        rate: 'The public lookup is busy right now. Try again in a moment.',
        error: 'Shelf lookup is unavailable right now. The example view stands in.'
      }[view.state];

      let liveFacts = null;
      if (view.state === 'holds') {
        const seasonHeld = season
          ? view.held.some((h) => h.sign.name === season.sign.name)
          : false;
        liveFacts = [
          { k: 'Shelf', v: `${view.held.length} Registry ${view.held.length === 1 ? 'sign' : 'signs'} found` },
          { k: 'Composition', v: shelfComposition(view.held) },
          {
            k: 'Season',
            v: season
              ? `${season.sign.name} season ${seasonHeld ? 'represented' : 'not represented'}`
              : 'Season unavailable'
          },
          { k: 'Address', v: shortAddress(view.address) }
        ];
      }

      return (
        <div className="idctx__example">
          <div className="idctx__example-head">
            <div className="idctx__example-title">Public Zodiacs shelf</div>
            <div className="idctx__example-sub">
              {live ? 'Live · read-only' : 'Example view'}
            </div>
          </div>

          {REGISTRY_AURA_ENABLED ? <form className="shelf__form" onSubmit={onSubmit}>
            <label className="shelf__label" htmlFor="shelf-input">
              View a public shelf
            </label>
            <div className="shelf__row">
              <input
                id="shelf-input"
                className="shelf__input mono"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste a Solana wallet address"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="shelf__submit" disabled={loading}>
                {loading ? 'Reading' : 'View'}
              </button>
            </div>
            <p className="shelf__hint">
              On View, Zodiacs.org sends this public address to the configured
              blockchain-data provider to check only the twelve Registry mints.
              Public addresses and request metadata may be linkable. No chart or
              birth data is sent. <a href="/privacy/">Privacy</a>
            </p>
            {hint && <p className="shelf__hint">{hint}</p>}
            {view.state === 'mint-hint' && (
              <p className="shelf__hint">
                That is an official Zodiac record, not a wallet. To check a
                token address, use <a href="#verify">Verify</a> above.
              </p>
            )}
            {live && (
              <p className="shelf__hint">
                <button type="button" className="shelf__clear" onClick={onClear}>
                  Back to the example view
                </button>
              </p>
            )}
          </form> : (
            <p className="shelf__hint">
              Live lookup is paused while Registry Collection is off. The illustrative
              shelf below makes no address or provider request.
            </p>
          )}

          <div role="status" aria-live="polite">
            {loading && (
              <div className="shelf__skel" aria-label="Reading shelf">
                {[0, 1, 2, 3].map((i) => (
                  <div className="shelf__skel-cell" key={i}>
                    <div className="shelf__skel-bar" />
                    <div className="shelf__skel-bar" />
                  </div>
                ))}
              </div>
            )}

            {view.state === 'holds' && (
              <>
                <div className="shelf__signs">
                  {view.held.map((h) => (
                    <a
                      className="shelf__sign"
                      key={h.sign.name}
                      href={`/registry/${h.sign.name.toLowerCase()}/`}
                    >
                      <img
                        src={`/assets/icons/${h.sign.name.toLowerCase()}.png`}
                        alt=""
                        loading="lazy"
                        width="26"
                        height="26"
                      />
                      <span className="shelf__sign-name">{h.sign.name}</span>
                      <span className="shelf__sign-amt">Found</span>
                    </a>
                  ))}
                </div>
                <div className="idctx__receipt">
                  {liveFacts.map((fact) => (
                    <div className="idctx__fact" key={fact.k}>
                      <div className="idctx__fact-k">{fact.k}</div>
                      <div className="idctx__fact-v">{fact.v}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {view.state === 'empty' && (
              <div className="shelf__empty">
                <p className="shelf__empty-line">No Registry-listed Zodiac was found at this address.</p>
                <p className="shelf__empty-sub">
                  The illustrative example remains available. No purchase is required.
                </p>
              </div>
            )}

            {!live && !loading && (
              <div className="idctx__receipt">
                {SHELF_EXAMPLE_FACTS.map((fact) => (
                  <div className="idctx__fact" key={fact.k}>
                    <div className="idctx__fact-k">{fact.k}</div>
                    <div className="idctx__fact-v">{fact.v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="idctx__note">
            {live
              ? 'One public Solana address was checked through the Zodiacs.org holdings endpoint. No chart or birth data was sent. Bridged Base representations are not included in this view.'
              : 'The SDK provides computed symbolic context and public-address holdings state. The interface chooses how to present it.'}
          </p>
        </div>
      );
    }

    function IdentityContextSection() {
      const reveal = useReveal();
      const cards = [
        {
          t: 'Verify a Zodiac',
          d: 'Check whether a public address contains an official Registry-listed Zodiac on Solana or Base. A match is not proof of identity, control, or legal ownership.'
        },
        {
          t: 'Read a collection',
          d: 'See the element mix, modality mix, wheel coverage, and seasonal pattern formed by the signs at one public address.'
        },
        {
          t: 'Build with the record',
          d: 'Use verified Registry facts in profiles, receipts, seasonal moments, verifiers, and other products.'
        },
        ...(REGISTRY_AURA_ENABLED ? [{
          kind: 'aura',
          t: REGISTRY_AURA_ENTRY_COPY.title,
          d: REGISTRY_AURA_ENTRY_COPY.description,
          href: REGISTRY_AURA_PATH,
          link: REGISTRY_AURA_ENTRY_COPY.link,
        }] : []),
      ];
      return (
        <section ref={reveal} id="identity" className="sec idctx reveal" aria-label="Identity Context">
          <div className="sec__head">
            <span className="sec__no">Nº 07</span>
            <span className="line" />
            <span className="sec__title">Identity Context</span>
          </div>

          <h2 className="idctx__statement">
            What the registry <span className="it">can do.</span>
          </h2>

          <p className="idctx__copy">
            Verify a Zodiac, read the pattern in a public collection, or carry
            Registry facts into another product. Add a saved birth chart later
            if you want one.
          </p>

          <div className="idctx__grid">
            {cards.map((card, i) => card.kind === 'aura' ? (
              <article className="idctx__card idctx__card--aura" key={card.t} data-registry-collection-entry>
                <div className="idctx__aura-intro">
                  <span className="idctx__num">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="idctx__card-title">{card.t}</h3>
                  <p className="idctx__card-copy">{card.d}</p>
                </div>
                <div className="idctx__aura-action">
                  <div className="idctx__aura-flow" aria-label="Public collection, optional saved chart, and today’s sky">
                    <span className="idctx__aura-step"><span aria-hidden="true">01</span>Public collection</span>
                    <span className="idctx__aura-arrow" aria-hidden="true">→</span>
                    <span className="idctx__aura-step"><span aria-hidden="true">02</span>Chart (optional)</span>
                    <span className="idctx__aura-arrow" aria-hidden="true">→</span>
                    <span className="idctx__aura-step"><span aria-hidden="true">03</span>Today’s sky</span>
                  </div>
                  <a className="idctx__card-link idctx__aura-link" href={card.href} onClick={() => trackAnalytics('aura_entry', { source: 'registry' })}>
                    <span>{card.link}</span>
                  </a>
                </div>
              </article>
            ) : (
              <article className="idctx__card" key={card.t}>
                <span className="idctx__num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="idctx__card-title">{card.t}</h3>
                <p className="idctx__card-copy">{card.d}</p>
              </article>
            ))}
          </div>

          <ShelfViewer />
        </section>
      );
    }

    const ACCESS_PRIMARY = [
      { name: 'Coinbase DEX', tag: 'Base onchain venue',  logo: '/assets/venues/coinbase.svg', url: 'https://wallet.coinbase.com/' },
      { name: 'Jupiter',      tag: 'Solana aggregator',   logo: '/assets/venues/jupiter.svg',  url: 'https://jup.ag/' },
      { name: 'fomo',         tag: 'Consumer onchain app', logo: '/assets/venues/fomo.svg',    url: 'https://fomo.family/' },
    ];
    const ACCESS_RAIL = [
      { name: 'OKX Wallet',     tag: 'Wallet interface',      logo: '/assets/venues/okx-wallet.svg',     url: 'https://web3.okx.com/' },
      { name: 'Binance Wallet', tag: 'Onchain token access',  logo: '/assets/venues/binance-wallet.svg', url: 'https://www.binance.com/en/web3wallet' },
      { name: 'Bybit Web3',     tag: 'Web3 interface',        logo: '/assets/venues/bybit-web3.svg',     url: 'https://www.bybit.com/web3/' },
      { name: 'Phantom',        tag: 'Solana wallet',         logo: '/assets/venues/phantom.svg',        url: 'https://phantom.com/' },
      { name: 'Solflare',       tag: 'Solana wallet',         logo: '/assets/venues/solflare.svg',       url: 'https://www.solflare.com/' },
      { name: 'Raydium',        tag: 'Solana onchain venue',  logo: '/assets/venues/raydium.svg',        url: 'https://raydium.io/' },
      { name: 'Orca',           tag: 'Solana onchain venue',  logo: '/assets/venues/orca.svg',           url: 'https://www.orca.so/' },
    ];

    /* Renders a venue logo if the SVG file exists; renders nothing if
       the file is missing (graceful no-op until brand assets are added). */
    function VenueLogo({ src }) {
      const [failed, setFailed] = useState(false);
      if (!src || failed) return null;
      return <img src={src} alt="" onError={() => setFailed(true)} loading="lazy" decoding="async" />;
    }

    function OnchainAccessSection() {
      const reveal = useReveal();
      return (
        <section ref={reveal} id="onchain-access" className="sec access reveal" aria-label="Onchain access">
          <div className="sec__head">
            <span className="sec__no">Nº 08</span>
            <span className="line" />
            <span className="sec__title">Onchain access</span>
          </div>

          <h2 className="access__statement">
            Independent routes across<br/>
            <span className="it">third-party onchain services.</span>
          </h2>

          <p className="access__copy">
            These links open independent Solana, Base, and wallet services;
            they are not endorsements or recommendations, and Zodiacs.org does
            not sell or execute transactions. A service may request a wallet
            connection, token approval, signature, and an onchain transaction
            that cannot be reversed. Digital assets are speculative, may become
            illiquid, and can lose all market value. You could lose all money
            used to acquire a Zodiac. Verify the official mint, network, amount,
            and destination before continuing. Operator and economic-interest
            statements remain pending confirmation; see the{' '}
            <a href="/disclosure/">Disclosure</a>.
          </p>

          <div className="access__primary" role="list">
            {ACCESS_PRIMARY.map(v => (
              <a className="access__card access__card--featured" role="listitem" key={v.name}
                 href={v.url} rel="noopener noreferrer external nofollow">
                <div className="access__logo" aria-hidden="true">
                  <VenueLogo src={v.logo} />
                </div>
                <div className="access__name">{v.name}</div>
                <div className="access__tag">{v.tag}</div>
              </a>
            ))}
          </div>

          <div className="access__rail-wrap" aria-label="More onchain venues">
            <div className="access__rail" role="list">
              {ACCESS_RAIL.map(v => (
                <a className="access__card access__card--rail" role="listitem" key={v.name}
                   href={v.url} rel="noopener noreferrer external nofollow">
                  <div className="access__logo" aria-hidden="true">
                    <VenueLogo src={v.logo} />
                  </div>
                  <div className="access__name">{v.name}</div>
                  <div className="access__tag">{v.tag}</div>
                </a>
              ))}
            </div>
          </div>

          <p className="access__note">
            Official mint addresses should always be verified through the
            Zodiacs.org <a className="access__note-link" href="#registry">registry</a> and{' '}
            <a className="access__note-link" href="#sdk">SDK</a>.
          </p>

          <div className="access__cta">
            <a className="btn btn--primary" href="#verify">
              <span>Verify official addresses</span>
              <span className="arr">→</span>
            </a>
            <a className="btn btn--ghost" href="#sdk">
              <span>View SDK</span>
              <span className="arr" style={{ width: 28, height: 28, background: 'transparent', border: 0, color: 'var(--ink-dim)' }}>↗</span>
            </a>
          </div>
        </section>
      );
    }

    function ForBuildersSection() {
      const reveal = useReveal();
      const capabilities = [
        'Official asset verification',
        'Native and bridged mappings',
        'Public Zodiac Shelves',
        'Public-record receipts',
        'Zodiac wheel views',
        'Birth chart overlays',
        'Wallet integrations',
        'Gallery integrations',
        'Public profiles',
        'Share cards',
        'Address-held context',
        'Seasonal context'
      ];

      return (
        <section ref={reveal} id="builders-overview" className="sec builders reveal" aria-label="For Builders">
          <div className="sec__head">
            <span className="sec__no">Nº 09</span>
            <span className="line" />
            <span className="sec__title">For Builders</span>
          </div>

          <h2 className="builders__statement">
            Infrastructure<br/>
            <span className="it">with a symbolic surface.</span>
          </h2>

          <p className="builders__copy">
            Zodiacs are not only a collection of assets. They are a verified
            symbolic layer that can extend into astrology products, wallets,
            galleries, profiles, share cards, and read-only public-record
            experiences.
          </p>

          <div className="builders__capabilities" aria-label="Builder capabilities">
            {capabilities.map((capability, i) => (
              <div className="builders__cap" key={capability}>
                <span className="builders__cap-k">{String(i + 1).padStart(2, '0')}</span>
                <span className="builders__cap-v">{capability}</span>
              </div>
            ))}
          </div>

          <a className="btn btn--primary builders__cta" href="/sdk/">
            <span>Explore the SDK</span>
            <span className="arr">→</span>
          </a>
        </section>
      );
    }

    function BuiltWithZodiacsSection() {
      const reveal = useReveal();
      const examples = [
        {
          t: 'Astrology apps',
          d: 'Use verified signs as a public layer beside charts, seasons, and symbolic profiles.'
        },
        {
          t: 'Horoscope products',
          d: 'Anchor seasonal and sign-aware experiences in the official registry.'
        },
        {
          t: 'Wallet experiences',
          d: 'Show native Solana holdings and official Base representations with clear provenance.'
        },
        {
          t: 'Gallery experiences',
          d: 'Arrange the Twelve as cultural assets, collections, shelves, and shareable rooms.'
        },
        {
          t: 'Profile systems',
          d: 'Turn public-address records into badges, wheel coverage, composition, and identity surfaces.'
        },
        {
          t: 'Identity layers',
          d: 'Give downstream interfaces a shared symbolic record to build around.'
        },
        {
          t: 'Social moments',
          d: 'Create public-record receipts, seasonal cards, and lightweight public displays.'
        },
        {
          t: 'AI astrology assistants',
          d: 'Ground symbolic interfaces in verified facts instead of loose address lists.'
        }
      ];

      return (
        <section ref={reveal} id="built-with-zodiacs" className="sec built reveal" aria-label="Built With Zodiacs">
          <div className="sec__head">
            <span className="sec__no">Nº 10</span>
            <span className="line" />
            <h2 className="sec__title">Built With Zodiacs</h2>
          </div>

          <p className="built__intro">
            The registry is the visible surface. Beneath it is a small ecosystem
            layer for the products people already want to make around symbolic
            identity.
          </p>

          <div className="built__grid">
            {examples.map((example, i) => (
              <article className="built__item" key={example.t}>
                <span className="built__k">Use case {String(i + 1).padStart(2, '0')}</span>
                <h3 className="built__title">{example.t}</h3>
                <p className="built__copy">{example.d}</p>
              </article>
            ))}
          </div>
        </section>
      );
    }

    function CodeBlock({ label, code }) {
      const [copied, setCopied] = useState(false);
      const onCopy = useCallback(() => {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }
      }, [code]);
      return (
        <div className="code">
          <div className="code__bar">
            <span className="code__dots" aria-hidden="true">
              <i /><i /><i />
            </span>
            <span className="code__label">{label}</span>
            <button
              type="button"
              className={'code__copy' + (copied ? ' is-copied' : '')}
              onClick={onCopy}
              aria-label="Copy code"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="code__pre"><code>{code}</code></pre>
        </div>
      );
    }

    function SdkSection() {
      const reveal = useReveal();
      const caps = [
        { t: 'Verify', d: 'Recognize official Zodiacs.org representations across Solana and Base.' },
        { t: 'Read', d: 'Read public-address holdings state without custody, signing, or transactions.' },
        { t: 'Compose', d: 'Shape held signs into seasonal context, wheel coverage, and identity surfaces.' },
      ];
      return (
        <section ref={reveal} id="sdk" className="sec reveal" aria-label="SDK">
          <div className="sec__head">
            <span className="sec__no">Nº 12</span>
            <span className="line" />
            <h2 className="sec__title">SDK</h2>
          </div>
          <p className="sec__lede">
            The SDK is the public interface to the same registry shown here.
            It gives apps verified facts for recognition, address-record display,
            and symbolic identity context.
          </p>

          <div className="sdk__caps">
            {caps.map((c, i) => (
              <div className="sdk__cap" key={i}>
                <div className="sdk__cap-t">{c.t}</div>
                <div className="sdk__cap-d">{c.d}</div>
              </div>
            ))}
          </div>

          <CodeBlock label="install" code="npm i @zodiacs/sdk" />

          <div className="sdk__icons" role="group" aria-label="Official sign icons, shipped with the SDK">
            {SIGNS.map(s => (
              <a
                key={s.ticker}
                className="sdk__icons-item"
                href={`/registry/${s.asset.sign}/`}
                title={`${s.name} — catalogue entry`}
                aria-label={`${s.name} — catalogue entry`}
              >
                <img
                  src={`/assets/sdk/zodiac-icons/circle/${s.asset.sign}.png`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </a>
            ))}
            <span className="sdk__icons-note">Official icon assets · all twelve · shipped with the SDK</span>
          </div>

          <div className="res">
            <a className="res__item" href="/sdk/">
              <span className="res__k">Page</span>
              <span className="res__v">Explore the SDK</span>
              <span className="res__arr" aria-hidden="true">↗</span>
            </a>
            <a className="res__item" href="https://www.npmjs.com/package/@zodiacs/sdk" rel="noopener noreferrer">
              <span className="res__k">npm</span>
              <span className="res__v">@zodiacs/sdk</span>
              <span className="res__arr" aria-hidden="true">↗</span>
            </a>
            <a className="res__item" href="https://github.com/zodiacs-org/sdk" rel="noopener noreferrer">
              <span className="res__k">GitHub</span>
              <span className="res__v">zodiacs-org/sdk</span>
              <span className="res__arr" aria-hidden="true">↗</span>
            </a>
            <a className="res__item" href="/registry/zodiacs.registry.json">
              <span className="res__k">Record</span>
              <span className="res__v">Public record</span>
              <span className="res__arr" aria-hidden="true">↗</span>
            </a>
            <a className="res__item" href="/sdk/#examples">
              <span className="res__k">Docs</span>
              <span className="res__v">Guides &amp; reference</span>
              <span className="res__arr" aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      );
    }

    function SecuritySection() {
      const reveal = useReveal();
      const nots = ['No private keys', 'No custody', 'No signing', 'No swaps', 'No approvals', 'No transactions'];
      return (
        <section ref={reveal} id="security" className="sec reveal" aria-label="Read-only by design">
          <div className="sec__head">
            <span className="sec__no">Nº 13</span>
            <span className="line" />
            <h2 className="sec__title">Read-only by design</h2>
          </div>
          <p className="sec__statement">
            The Registry, Registry Collection, and SDK lookup/display tools are made
            for recognition and display. They read public information but do
            not request signatures, approvals, swaps, network changes, or
            transactions, and they cannot hold or move assets. Wallets, market
            services, and trading venues reached through outbound links are
            independent third parties and may request those actions under their
            own terms. Never share a seed phrase or private key.
          </p>
          <p className="sec__disclosure">
            &ldquo;Official&rdquo; means that an asset address appears in this Registry. It
            is not government, regulator, wallet, or exchange approval, and it
            does not prove identity, control, legal ownership, safety, value,
            liquidity, or future performance.
          </p>
          <div className="ro__grid">
            {nots.map((n, i) => (
              <div className="ro__item" key={i}>
                <span className="ro__mark" aria-hidden="true">—</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </section>
      );
    }

    const FAQ_GROUPS = [
      {
        label: 'The Registry',
        items: [
          { q: 'What is Zodiacs.org?',
            a: 'The official public registry for the twelve Zodiacs: their identities, records, origin, and verified representations.' },
          { q: 'What can I do here?',
            a: 'Explore the Twelve, verify an address against the registry, inspect the public record, and see how address holdings can become symbolic context.' },
          { q: 'What can be built with Zodiacs?',
            a: 'Profiles, galleries, wallet views, Zodiac shelves, public-record receipts, zodiac wheel views, seasonal moments, and astrology-native interfaces.' },
          { q: 'Where is the official Astrofolio experience?',
            a: 'Astrofolio is the official Zodiacs.org consumer collection experience at zodiacs.org/astrofolio. Astrofolio.xyz redirects there; it is not a separate app.' },
          { q: 'What does the SDK add?',
            a: 'It gives apps a read-only way to recognize official Zodiacs, show records, read public-address holdings, and compute display-ready symbolic context.' },
          { q: 'Why Solana and Base?',
            a: 'The original Zodiacs live on Solana. The Base records are official bridged counterparts that point back to those Solana origins.' }
        ]
      },
      {
        label: 'Ownership and separate services',
        items: [
          { q: 'Does the Registry ask me to connect anything?',
            a: 'No. You can browse the records and verify addresses without connecting a wallet.' },
          { q: 'Does the registry prove presale or allocation history?',
            a: 'No. The registry verifies official addresses and provenance; it does not independently establish presale, allocation, or trading-history claims.' }
        ]
      },
      {
        label: 'Legitimacy & Trust',
        items: [
          { q: 'How do I know an address is official?',
            a: <>Check it against the record. The verifier recognizes exactly twenty-four addresses: twelve native Solana mints and twelve bridged Base representations. Anything else is reported as {REGISTRY_VERIFIER_NOT_FOUND_INLINE}. The same addresses are mirrored in the public SDK repository and used by the official Astrofolio experience at <a href="/astrofolio/">zodiacs.org/astrofolio</a>; the Libra record was also corroborated character for character in the events preserved in <a href="/archive/#accidental-libra">the archive</a>.</> },
          { q: 'Other tokens use the same names. Which is real?',
            a: 'Names and tickers can be copied; addresses cannot. Only the addresses in the registry are official records. When in doubt, verify the address itself, never the ticker.' },
          { q: 'Is this related to the LIBRA token from the news?',
            a: <>No. In early 2025 an unrelated token of that name collapsed in public view, and buyers went looking for the real one. The official Libra record predates that episode and sits in the registry. The full story is preserved in <a href="/archive/#accidental-libra">the archive</a>.</> },
          { q: 'What if an address is not listed?',
            a: <>The verifier reports that it was {REGISTRY_VERIFIER_NOT_FOUND_INLINE}.</> }
        ]
      },
      {
        label: 'Astrology & Culture',
        items: [
          { q: 'Why put the zodiac onchain?',
            a: 'The twelve signs are a symbolic language in continuous use for more than two thousand years, an identity system older than most institutions that issue identity. The registry gives each sign one durable public record.' },
          { q: 'Do I have to believe in astrology?',
            a: 'No. The signs function as cultural symbols whether or not the stars are consulted. The registry records assets and provenance, not doctrine.' },
          { q: 'Can I only hold my own sign?',
            a: 'Anyone may hold any sign, in any combination. Many begin with their sun sign; collectors assemble elements, seasons, or the full wheel.' },
          { q: 'Does Zodiacs claim ownership of astrology?',
            a: 'No. Zodiacs keeps the register for these twelve assets. It makes no claim over astrology, the signs, or their symbols.' }
        ]
      },
      {
        label: 'Risk & Posture',
        items: [
          { q: 'Does this site recommend Zodiacs as an investment?',
            a: 'No. Nothing on this site promises profit or recommends buying, selling, or holding a Zodiac. Market data and third-party access links are informational and can be delayed, incomplete, or wrong.' },
          { q: 'What are the risks?',
            a: 'Prices can be volatile, liquidity can be limited or disappear, and a Zodiac can lose all market value. You could lose all money used to acquire one. Wallet loss, scams, contract bugs, bridge failures, and user mistakes can cause permanent loss. Onchain transactions generally cannot be reversed.' },
          { q: 'What happens if this site goes away?',
            a: 'Nothing happens to the assets. They live onchain. The registry file is mirrored in the SDK package and the public repository, so the record outlives any single page.' },
          { q: 'Does the site or SDK move assets?',
            a: 'No. The Registry and SDK do not request asset transfers, signatures, approvals, or transactions.' },
          { q: 'What is Market Context?',
            a: 'Optional third-party data from Dex Screener. It is not a valuation or recommendation, may be delayed, incomplete, unavailable, or wrong, and is secondary to identity, registry, and verification.' }
        ]
      }
    ];

    function FaqSection() {
      const reveal = useReveal();
      return (
        <section ref={reveal} id="faq" className="sec reveal" aria-label="Questions">
          <div className="sec__head">
            <span className="sec__no">Nº 14</span>
            <span className="line" />
            <h2 className="sec__title">Questions</h2>
          </div>
          {FAQ_GROUPS.map((group) => (
            <div className="faq__group" key={group.label}>
              <h3 className="faq__group-label">{group.label}</h3>
              <dl className="faq">
                {group.items.map((item) => (
                  <div className="faq__item" key={item.q}>
                    <dt className="faq__q">{item.q}</dt>
                    <dd className="faq__a">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      );
    }
    const MARKET_RANKS = Object.freeze({
      marketCap: { label: 'Reported market cap', short: 'Mkt cap', field: 'marketCap' },
      liquidity: { label: 'Indexed liquidity', short: 'Liquidity', field: 'liquidityUsd' },
      change: { label: '24h move', short: '24H', field: 'priceChange24h' },
    });

    function TerminalViewLink({ view, sign, surface = 'header', keepRank = false, className = '' }) {
      const pro = view === 'pro';
      const direction = pro ? 'consumer_to_pro' : 'pro_to_consumer';
      return (
        <a
          className={className}
          href={terminalViewHref(view, sign, { keepRank })}
          data-terminal-view-link={view}
          onClick={() => rememberTerminalView(view, surface, direction)}
        >
          {pro ? 'Open the Terminal' : 'Astrofolio'} <span aria-hidden="true">↗</span>
        </a>
      );
    }

    function plainMarketMovement(value) {
      const movement = toFiniteNumber(value);
      if (movement === null) return 'movement unavailable';
      if (movement > 0) return `up ${formatPercent(movement).replace('+', '')} today`;
      if (movement < 0) return `down ${formatPercent(Math.abs(movement)).replace('+', '')} today`;
      return 'unchanged today';
    }

    function marketRankForSign(sign, batch, field = 'marketCap') {
      if (batch.status !== 'ok') return 0;
      const ranked = SIGNS
        .map(item => ({ item, value: toFiniteNumber(batch.quotes[item.asset.sign]?.[field]) }))
        .filter(entry => entry.value !== null)
        .sort((left, right) => right.value - left.value || left.item.order - right.item.order);
      return ranked.findIndex(entry => entry.item.ticker === sign.ticker) + 1;
    }

    // ──────────────────────────────────────────────────────────────
    // Astrofolio · Campaign
    // The owner-selected launch layout (Option B, 2026-09-23): the
    // Astrofolio film opens inside the wordmark, the twelve follow on a
    // runway that moves sideways as the page scrolls, and Fomo is the store.
    // Prices are the one batched live read; each line is the committed
    // daily snapshot archive. Nothing on the runway is invented.
    // ──────────────────────────────────────────────────────────────
    const CAMPAIGN_FILM = Object.freeze({
      av1: '/assets/fomo/fomo-film-av1.mp4',
      h264: '/assets/fomo/fomo-film.mp4',
      posterAvif: '/assets/fomo/fomo-film-poster.avif',
      posterWebp: '/assets/fomo/fomo-film-poster.webp',
    });
    const CAMPAIGN_APP_FOOTAGE = Object.freeze({
      av1: '/assets/fomo/fomo-zodiacs-av1.mp4',
      h264: '/assets/fomo/fomo-zodiacs.mp4',
      posterAvif: '/assets/fomo/fomo-zodiacs-poster.avif',
      posterWebp: '/assets/fomo/fomo-zodiacs-poster.webp',
    });
    // Fomo's own destinations; no referral or partner parameter is added.
    const FOMO_WEB_URL = 'https://fomo.family/';
    const FOMO_APP_STORE_URL = 'https://apps.apple.com/us/app/fomo-never-miss-out/id6741115427';
    const FOMO_PLAY_URL = 'https://play.google.com/store/apps/details?id=family.fomo.app';
    const CAMPAIGN_WIDE_QUERY = '(min-width: 901px)';
    const CAMPAIGN_PHONE_QUERY = '(max-width: 900px)';
    const CAMPAIGN_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
    const CAMPAIGN_SPARK_DAYS = 14;

    const clampUnit = (value) => Math.min(1, Math.max(0, value));
    const easeOutCubic = (value) => 1 - ((1 - value) ** 3);

    function matchesMedia(query) {
      try {
        return window.matchMedia(query).matches;
      } catch {
        return false;
      }
    }

    function useMediaMatch(query) {
      const [matches, setMatches] = useState(() => matchesMedia(query));
      useEffect(() => {
        let list = null;
        try {
          list = window.matchMedia(query);
        } catch {
          return undefined;
        }
        const update = () => setMatches(list.matches);
        update();
        list.addEventListener?.('change', update);
        return () => list.removeEventListener?.('change', update);
      }, [query]);
      return matches;
    }

    // The scroll-driven stage (pinned hero and runway) runs only on wide
    // screens with motion allowed. Everywhere else the same markup reads as
    // a still film, a swipeable runway, and ordinary sections.
    function campaignStageActive() {
      return matchesMedia(CAMPAIGN_WIDE_QUERY) && !matchesMedia(CAMPAIGN_REDUCED_MOTION_QUERY);
    }

    function formatSnapshotDay(date) {
      const parsed = new Date(`${date}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return String(date || '');
      return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }

    function campaignOrder(anchorTicker) {
      const start = Math.max(0, SIGNS.findIndex((item) => item.ticker === anchorTicker));
      return [...SIGNS.slice(start), ...SIGNS.slice(0, start)];
    }

    // Films follow the /fomo/ rules: the poster is the complete reduced-motion
    // and constrained-data experience. Sources attach only after the page's
    // load event and while the film is on screen, so the poster stays the
    // largest paint, and playback rests whenever the film leaves the screen
    // or the tab hides.
    function useCampaignFilm(videoRef, stageRef, threshold = 0.01) {
      const [playing, setPlaying] = useState(false);
      useEffect(() => {
        const video = videoRef.current;
        const stage = stageRef.current;
        if (!video || !stage || !('IntersectionObserver' in window)) return undefined;
        const connection = navigator.connection;
        const constrained = Boolean(connection && (
          connection.saveData || ['slow-2g', '2g'].includes(connection.effectiveType || '')
        ));
        if (constrained || matchesMedia(CAMPAIGN_REDUCED_MOTION_QUERY)) return undefined;
        let cancelled = false;
        let attached = false;
        let onScreen = false;
        let ready = document.readyState === 'complete';
        video.muted = true;
        video.defaultMuted = true;
        const attach = () => {
          if (attached) return;
          attached = true;
          video.querySelectorAll('source[data-src]').forEach((source) => {
            source.src = source.dataset.src || '';
            source.removeAttribute('data-src');
          });
          video.load();
        };
        const play = () => {
          if (cancelled || !ready || !onScreen || document.hidden) return;
          if (matchesMedia(CAMPAIGN_REDUCED_MOTION_QUERY)) return;
          attach();
          video.play().catch(() => {
            if (!cancelled) setPlaying(false);
          });
        };
        const rest = () => {
          if (attached && !video.paused) video.pause();
        };
        const onPlaying = () => { if (!cancelled) setPlaying(true); };
        const onFailure = () => { if (!cancelled) setPlaying(false); };
        const onLoad = () => { ready = true; play(); };
        const onVisibility = () => { if (document.hidden) rest(); else play(); };
        let motion = null;
        const onMotion = () => {
          if (!motion?.matches) {
            play();
            return;
          }
          rest();
          setPlaying(false);
        };
        const observer = new IntersectionObserver(([entry]) => {
          onScreen = Boolean(entry?.isIntersecting);
          if (onScreen) play();
          else rest();
        }, { threshold });
        observer.observe(stage);
        video.addEventListener('playing', onPlaying);
        // <source> errors do not bubble; the capture phase still sees them.
        video.addEventListener('error', onFailure, true);
        if (!ready) window.addEventListener('load', onLoad, { once: true });
        document.addEventListener('visibilitychange', onVisibility);
        try {
          motion = window.matchMedia(CAMPAIGN_REDUCED_MOTION_QUERY);
          motion.addEventListener?.('change', onMotion);
        } catch { /* media query unavailable: the film simply keeps its state */ }
        return () => {
          cancelled = true;
          observer.disconnect();
          video.removeEventListener('playing', onPlaying);
          video.removeEventListener('error', onFailure, true);
          window.removeEventListener('load', onLoad);
          document.removeEventListener('visibilitychange', onVisibility);
          motion?.removeEventListener?.('change', onMotion);
        };
      }, [threshold]);
      return playing;
    }

    function FomoBuyButton({ item, source }) {
      return (
        <a
          className="btn btn--fomo"
          href={fomoBuyPath(item)}
          rel="external nofollow"
          aria-label={`Open Fomo to buy ${item.name}`}
          data-fomo-buy={item.asset.sign}
          onClick={() => trackAnalytics('astrofolio_fomo_open', { sign: item.asset.sign, source })}
        >
          <img src="/assets/venues/fomo-official.svg" width="34" height="34" alt="" />
          <span className="btn--fomo__copy"><small>{item.name} <span className="btn--fomo__zodiac-emoji" aria-hidden="true">{zodiacEmoji(item)}</span></small><strong>Buy with Fomo</strong></span>
          <span className="btn--fomo__arrow" aria-hidden="true">↗</span>
        </a>
      );
    }

    function CampaignHero() {
      const season = useCurrentSeason()?.sign ?? SIGNS[0];
      const heroRef = useRef(null);
      const filmRef = useRef(null);
      const videoRef = useRef(null);
      const playing = useCampaignFilm(videoRef, filmRef);
      useEffect(() => {
        const hero = heroRef.current;
        const film = filmRef.current;
        if (!hero || !film) return undefined;
        let frame = 0;
        const paint = () => {
          frame = 0;
          if (!campaignStageActive()) {
            hero.style.removeProperty('--hero-scale');
            hero.style.removeProperty('--hero-out');
            hero.style.removeProperty('--hero-caption');
            hero.dataset.caption = 'live';
            // On phones the film dims, the caption fades and the runway rises
            // as scroll-driven animations in the stylesheet, so the scroll
            // itself drives them and nothing here runs per frame.
            return;
          }
          // The film opens from its place inside the wordmark until it
          // covers the screen, then the headline arrives over it.
          const width = film.offsetWidth;
          const height = film.offsetHeight;
          const span = Math.max(1, hero.offsetHeight - window.innerHeight);
          const progress = clampUnit(-hero.getBoundingClientRect().top / span);
          const grow = easeOutCubic(clampUnit(progress / 0.72));
          const cover = width && height
            ? Math.max(window.innerWidth / width, window.innerHeight / height) * 1.002
            : 1;
          const caption = clampUnit((progress - 0.6) / 0.3);
          hero.style.setProperty('--hero-scale', (1 + (cover - 1) * grow).toFixed(4));
          hero.style.setProperty('--hero-out', grow.toFixed(4));
          hero.style.setProperty('--hero-caption', caption.toFixed(3));
          hero.dataset.caption = caption > 0.5 ? 'live' : 'rest';
        };
        const schedule = () => {
          if (!frame) frame = window.requestAnimationFrame(paint);
        };
        paint();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        document.fonts?.ready?.then(schedule);
        return () => {
          window.cancelAnimationFrame(frame);
          window.removeEventListener('scroll', schedule);
          window.removeEventListener('resize', schedule);
        };
      }, []);
      return (
        <section
          id="official-twelve"
          ref={heroRef}
          className="campaign-hero"
          aria-labelledby="campaign-hero-title"
          data-caption="rest"
          style={{ '--active-sign': season.hue }}
        >
          <div className="campaign-hero__pin">
            <div className="campaign-hero__film" ref={filmRef} data-playing={playing ? 'true' : 'false'}>
              <picture className="campaign-hero__poster">
                <source srcSet={CAMPAIGN_FILM.posterAvif} type="image/avif" />
                <img src={CAMPAIGN_FILM.posterWebp} width="1080" height="1920" alt="" decoding="async" />
              </picture>
              <video
                ref={videoRef}
                className="campaign-hero__video"
                muted
                loop
                playsInline
                preload="none"
                disablePictureInPicture
                tabIndex={-1}
                aria-hidden="true"
              >
                <source data-src={CAMPAIGN_FILM.av1} type={'video/mp4; codecs="av01.0.08M.08"'} />
                <source data-src={CAMPAIGN_FILM.h264} type="video/mp4" />
              </video>
              <span className="campaign-hero__shade" aria-hidden="true" />
            </div>
            <span className="campaign-hero__word campaign-hero__word--astro" aria-hidden="true">Astro</span>
            <span className="campaign-hero__word campaign-hero__word--folio" aria-hidden="true">folio</span>
            <div className="campaign-hero__foot" aria-hidden="true">
              <p>Twelve tokens, one for every sign. Each has its own design and public record.</p>
              <span>Scroll <i>↓</i></span>
            </div>
            <div className="campaign-hero__caption">
              <div className="astrofolio-lockup">
                <img
                  className="astrofolio-lockup__avatar"
                  src="/assets/astrofolio/v2/zodiac-ring-192.png"
                  width="84"
                  height="84"
                  alt=""
                  decoding="async"
                />
                <span className="astrofolio-lockup__copy">
                  <em className="terminal-consumer-hero__kicker">Astrofolio</em>
                  <small><strong style={{ color: season.hue }}>{season.name}</strong> Season</small>
                </span>
              </div>
              <h1 id="campaign-hero-title">Twelve signs. Twelve tokens.</h1>
              <p>One for every sign, each with its own design and a public record. Find yours, then buy it in the Fomo app.</p>
              <div className="campaign-hero__actions">
                <a className="campaign-button campaign-button--light" href="#the-twelve">
                  <span>Find your sign</span><span aria-hidden="true">↓</span>
                </a>
                <a className="campaign-button" href="#buy"><span>How buying works</span></a>
              </div>
              <p className="campaign-hero__name">Astro<em>folio</em></p>
              <a className="campaign-discover" href="#the-twelve">
                <span className="campaign-discover__pill">Discover more</span>
                <svg className="campaign-discover__cue" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M4 7l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </div>
          </div>
        </section>
      );
    }

    // A price line over the committed daily snapshots. Missing reads are
    // skipped, never interpolated or invented.
    function CampaignSpark({ item, observations }) {
      const points = (observations || [])
        .filter((point) => point.priceUsd !== null && point.priceUsd > 0)
        .slice(-CAMPAIGN_SPARK_DAYS);
      if (points.length < 2) return <span className="campaign-spark is-empty" aria-hidden="true" />;
      const width = 120;
      const height = 40;
      const pad = 3;
      const values = points.map((point) => point.priceUsd);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const x = (index) => pad + (index / (points.length - 1)) * (width - pad * 2);
      const y = (value) => (max === min
        ? height / 2
        : height - pad - ((value - min) / (max - min)) * (height - pad * 2));
      const line = points
        .map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(point.priceUsd).toFixed(1)}`)
        .join(' ');
      const first = points[0];
      const last = points[points.length - 1];
      const label = `${item.name} price over ${points.length} daily reads: ${formatPriceUsd(first.priceUsd)} on ${formatSnapshotDay(first.date)}, ${formatPriceUsd(last.priceUsd)} on ${formatSnapshotDay(last.date)}.`;
      return (
        <svg className="campaign-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
          <path className="campaign-spark__area" d={`${line} L${x(points.length - 1).toFixed(1)} ${height} L${x(0).toFixed(1)} ${height} Z`} />
          <path className="campaign-spark__line" d={line} vectorEffect="non-scaling-stroke" />
        </svg>
      );
    }

    function CampaignLook({ item, index, seasonTicker, batch, observations, active, onKeyboardFocus }) {
      const slug = item.asset.sign;
      const [artworkFailed, setArtworkFailed] = useState(false);
      const inSeason = item.ticker === seasonTicker;
      return (
        <article
          className={'campaign-look' + (inSeason ? ' is-season' : '') + (active ? ' is-active' : '')}
          data-look={slug}
          style={{ '--sign': item.hue }}
          aria-labelledby={`campaign-look-${slug}`}
          onFocus={(event) => {
            // Keyboard focus inside the pinned runway brings the look into
            // view. Pointer focus is left alone so a click is never moved.
            if (event.target.matches?.(':focus-visible')) onKeyboardFocus(index);
          }}
        >
          <p className="campaign-look__top">
            <b>{ROMAN[item.order - 1]}</b>
            {inSeason
              ? <span className="campaign-look__tag">In season now</span>
              : <span>{consumerSignDateLabel(item)}</span>}
          </p>
          <h3 id={`campaign-look-${slug}`}>{item.name}</h3>
          <div className={'campaign-look__art' + (artworkFailed ? ' is-fallback' : '')}>
            <img
              className="campaign-look__stars"
              src={`/assets/constellations/${slug}.svg`}
              width="720"
              height="460"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <img
              className="campaign-look__figure"
              src={`/assets/sculptures/512/${slug}.webp`}
              srcSet={`/assets/sculptures/512/${slug}.webp 512w, /assets/sculptures/1024/${slug}.webp 1024w`}
              sizes="(max-width: 900px) 72vw, 380px"
              width="512"
              height="512"
              alt={`${item.name} Zodiac artwork`}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                const image = event.currentTarget;
                const attempt = Number(image.dataset.fallbackAttempt || 0);
                if (attempt === 0) {
                  image.dataset.fallbackAttempt = '1';
                  image.srcset = '';
                  image.src = `/assets/sculptures/512/${slug}.webp`;
                  return;
                }
                if (attempt === 1) {
                  image.dataset.fallbackAttempt = '2';
                  image.src = `/assets/cabinet-materials/gold/${slug}.webp`;
                  return;
                }
                setArtworkFailed(true);
              }}
            />
            <span
              className="campaign-look__fallback"
              role={artworkFailed ? 'img' : undefined}
              aria-label={artworkFailed ? `${item.name} artwork unavailable; ${item.symbol} symbol shown` : undefined}
              aria-hidden={artworkFailed ? undefined : 'true'}
            >
              {item.symbol}
            </span>
          </div>
          <div className="campaign-look__stats">
            <VitrinePrice sign={item} batch={batch} live={false} />
            <CampaignSpark item={item} observations={observations} />
          </div>
          <div className="campaign-look__actions">
            <FomoBuyButton item={item} source="runway" />
            <a className="campaign-look__explore" href={registryProfilePath(item)}>Explore {item.name}</a>
          </div>
          <p className="vitrine-buy-options">
            <a href={howToBuyPath(item)}>Other ways to buy</a>
            <span aria-hidden="true">·</span>
            <span>Opens the Fomo app</span>
          </p>
        </article>
      );
    }

    function CampaignRunway({ anchorTicker, active, setActive, batch }) {
      const seasonTicker = useCurrentSeason()?.sign.ticker ?? '';
      const order = useMemo(() => campaignOrder(anchorTicker), [anchorTicker]);
      const sectionRef = useRef(null);
      const trackRef = useRef(null);
      const dotsRef = useRef(null);
      const stageRef = useRef({ pinned: false, max: 0 });
      const [position, setPosition] = useState(0);
      const [historyWanted, setHistoryWanted] = useState(false);
      const history = useRegistryMarketHistory(historyWanted);
      const ledgers = useMemo(() => Object.fromEntries(SIGNS.map((item) => [
        item.asset.sign,
        marketHistoryForSign(history.data, item.asset.sign).observations,
      ])), [history.data]);
      const activeIndex = Math.max(0, SIGNS.findIndex((item) => item.ticker === active));

      // The daily lines are the only extra read, fetched as the runway nears.
      useEffect(() => {
        const section = sectionRef.current;
        if (!section) return undefined;
        if (!('IntersectionObserver' in window)) {
          setHistoryWanted(true);
          return undefined;
        }
        const observer = new IntersectionObserver(([entry]) => {
          if (!entry?.isIntersecting) return;
          setHistoryWanted(true);
          observer.disconnect();
        }, { rootMargin: '600px 0px' });
        observer.observe(section);
        return () => observer.disconnect();
      }, []);

      const activeRef = useRef(active);
      const steerRef = useRef(null);
      const settleRef = useRef({ timer: 0, committed: active });
      // A sign chosen outside the runway (the bag's picker) brings its look
      // to the middle of the swipeable runway without moving the page. Disc
      // taps and swipes update activeRef first, so they never land here.
      useEffect(() => {
        if (active === activeRef.current) return;
        activeRef.current = active;
        settleRef.current.committed = active;
        window.clearTimeout(settleRef.current.timer);
        const track = trackRef.current;
        const look = track?.children[order.findIndex((item) => item.ticker === active)];
        if (stageRef.current.pinned || !track || !look) return;
        const bounds = track.getBoundingClientRect();
        const inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
        steerRef.current = { ticker: active, until: window.performance.now() + 1200 };
        track.scrollTo({
          left: look.offsetLeft - (track.clientWidth - look.offsetWidth) / 2,
          behavior: inView && !matchesMedia(CAMPAIGN_REDUCED_MOTION_QUERY) ? 'smooth' : 'instant',
        });
      }, [active, order]);

      // The count follows the runway: on the pinned stage it advances with
      // the page's progress (the first look at the start, the last at the
      // end); in the swipeable runway it is the look nearest the centre.
      // Passing looks on the pinned stage never changes the chosen sign.
      const pickLook = useCallback((progress = null) => {
        const track = trackRef.current;
        if (!track) return;
        let best = -1;
        if (progress !== null) {
          best = Math.round(clampUnit(progress) * (order.length - 1));
        } else {
          const bounds = track.getBoundingClientRect();
          const centre = bounds.left + bounds.width / 2;
          let distance = Infinity;
          [...track.children].forEach((look, index) => {
            const rect = look.getBoundingClientRect();
            const gap = Math.abs(rect.left + rect.width / 2 - centre);
            if (gap < distance) {
              distance = gap;
              best = index;
            }
          });
        }
        if (best >= 0) setPosition(best);
        return best;
      }, [order.length]);

      // On phones a swipe moves the spotlight: the look that settles in the
      // centre becomes the chosen sign, and the address bar follows once the
      // swipe rests. A disc tap steering the runway is never overridden by
      // the looks it passes on the way.
      const followSwipe = useCallback((best) => {
        if (stageRef.current.pinned || !matchesMedia(CAMPAIGN_PHONE_QUERY)) return;
        const ticker = order[best]?.ticker;
        if (!ticker) return;
        const steer = steerRef.current;
        if (steer) {
          if (ticker !== steer.ticker && window.performance.now() < steer.until) return;
          steerRef.current = null;
          if (ticker === steer.ticker) return;
        }
        if (ticker !== activeRef.current) {
          activeRef.current = ticker;
          // A low-priority update, so a fast swipe stays smooth.
          if (typeof React.startTransition === 'function') React.startTransition(() => setActive(ticker));
          else setActive(ticker);
        }
        const settle = settleRef.current;
        window.clearTimeout(settle.timer);
        settle.timer = window.setTimeout(() => {
          const chosen = SIGNS.find((item) => item.ticker === activeRef.current);
          if (!chosen || chosen.ticker === settle.committed) return;
          settle.committed = chosen.ticker;
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('sign', chosen.asset.sign);
            window.history.replaceState(null, '', `${url.pathname}?${url.searchParams}${url.hash}`);
          } catch { /* malformed URL: the choice still stands */ }
          trackAnalytics('registry_sign_selected', { sign: chosen.asset.sign, source: 'consumer_swipe' });
        }, 240);
      }, [order, setActive]);
      useEffect(() => () => window.clearTimeout(settleRef.current.timer), []);

      useEffect(() => {
        const section = sectionRef.current;
        const track = trackRef.current;
        if (!section || !track) return undefined;
        let frame = 0;
        const measure = () => {
          const stage = stageRef.current;
          stage.pinned = campaignStageActive();
          section.dataset.mode = stage.pinned ? 'pinned' : 'carousel';
          if (!stage.pinned) {
            stage.max = 0;
            section.style.removeProperty('height');
            track.style.removeProperty('transform');
            return;
          }
          const last = track.lastElementChild;
          const trailing = Number.parseFloat(window.getComputedStyle(track).paddingRight) || 0;
          stage.max = last
            ? Math.max(0, last.offsetLeft + last.offsetWidth + trailing - track.clientWidth)
            : 0;
          // One screen of pinning plus the sideways distance, so a steady
          // scroll carries every look past the centre of the screen.
          section.style.height = `${Math.round(window.innerHeight + stage.max * 1.05)}px`;
        };
        const paint = () => {
          frame = 0;
          const stage = stageRef.current;
          if (!stage.pinned) return;
          const rect = section.getBoundingClientRect();
          const span = Math.max(1, section.offsetHeight - window.innerHeight);
          const progress = clampUnit(-rect.top / span);
          track.style.transform = `translate3d(${(-progress * stage.max).toFixed(1)}px, 0, 0)`;
          if (rect.top <= 1 && rect.bottom >= window.innerHeight - 1) pickLook(progress);
        };
        const schedule = () => {
          if (!frame) frame = window.requestAnimationFrame(paint);
        };
        const onResize = () => {
          measure();
          schedule();
        };
        const onTrackScroll = () => {
          if (!stageRef.current.pinned) window.requestAnimationFrame(() => followSwipe(pickLook()));
        };
        measure();
        paint();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', onResize);
        track.addEventListener('scroll', onTrackScroll, { passive: true });
        const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(onResize) : null;
        resizeObserver?.observe(track);
        let motion = null;
        try {
          motion = window.matchMedia(CAMPAIGN_REDUCED_MOTION_QUERY);
          motion.addEventListener?.('change', onResize);
        } catch { /* media query unavailable: the stage keeps its mode */ }
        return () => {
          window.cancelAnimationFrame(frame);
          window.removeEventListener('scroll', schedule);
          window.removeEventListener('resize', onResize);
          track.removeEventListener('scroll', onTrackScroll);
          resizeObserver?.disconnect();
          motion?.removeEventListener?.('change', onResize);
        };
      }, [pickLook, followSwipe]);

      const showLook = useCallback((ticker, behavior) => {
        const section = sectionRef.current;
        const track = trackRef.current;
        const look = track?.children[order.findIndex((item) => item.ticker === ticker)];
        if (!section || !track || !look) return;
        const stage = stageRef.current;
        if (stage.pinned) {
          const target = Math.min(stage.max, Math.max(0, look.offsetLeft + look.offsetWidth / 2 - track.clientWidth / 2));
          const span = Math.max(1, section.offsetHeight - window.innerHeight);
          const top = section.getBoundingClientRect().top + window.scrollY + (stage.max ? target / stage.max : 0) * span;
          window.scrollTo({ top: Math.round(top), behavior });
          return;
        }
        track.scrollTo({ left: look.offsetLeft - (track.clientWidth - look.offsetWidth) / 2, behavior });
        const rect = section.getBoundingClientRect();
        if (rect.top > window.innerHeight * 0.5 || rect.bottom < window.innerHeight * 0.5) {
          section.scrollIntoView({ block: 'start', behavior });
        }
      }, [order]);

      const onKeyboardFocus = useCallback((index) => {
        if (!stageRef.current.pinned || !order[index]) return;
        showLook(order[index].ticker, 'instant');
      }, [order, showLook]);

      const choose = (index, focus = false) => {
        const next = SIGNS[Math.min(SIGNS.length - 1, Math.max(0, index))];
        if (!next) return;
        setActive(next.ticker);
        activeRef.current = next.ticker;
        settleRef.current.committed = next.ticker;
        window.clearTimeout(settleRef.current.timer);
        if (!stageRef.current.pinned) steerRef.current = { ticker: next.ticker, until: window.performance.now() + 1200 };
        showLook(next.ticker, matchesMedia(CAMPAIGN_REDUCED_MOTION_QUERY) ? 'instant' : 'smooth');
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('sign', next.asset.sign);
          window.history.replaceState(null, '', `${url.pathname}?${url.searchParams}${url.hash}`);
        } catch { /* malformed URL: selection still remains usable */ }
        if (focus) {
          window.requestAnimationFrame(() => {
            dotsRef.current?.querySelector(`[data-consumer-sign="${next.asset.sign}"]`)?.focus({ preventScroll: true });
          });
        }
        trackAnalytics('registry_sign_selected', { sign: next.asset.sign, source: 'consumer_explorer' });
      };
      const onDotsKeyDown = (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const columns = Number.parseInt(window.getComputedStyle(dotsRef.current)
          .getPropertyValue('--campaign-dot-columns'), 10) || SIGNS.length;
        const moves = {
          ArrowRight: Math.min(SIGNS.length - 1, activeIndex + 1),
          ArrowLeft: Math.max(0, activeIndex - 1),
          ArrowDown: activeIndex + columns < SIGNS.length ? activeIndex + columns : activeIndex,
          ArrowUp: activeIndex >= columns ? activeIndex - columns : activeIndex,
          Home: 0,
          End: SIGNS.length - 1,
        };
        if (!(event.key in moves)) return;
        event.preventDefault();
        choose(moves[event.key], true);
      };

      const observed = batch.observedAt
        ? new Date(batch.observedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : '';
      const status = batch.status === 'ok'
        ? `Prices read ${observed || 'just now'}${batch.stale ? ' · delayed' : ''}`
        : batch.status === 'unavailable' ? 'Prices unavailable · retrying automatically' : 'Reading prices…';

      return (
        <section
          id="the-twelve"
          ref={sectionRef}
          className="campaign-runway"
          aria-labelledby="campaign-runway-title"
          data-mode="carousel"
        >
          <span id="consumer-sign-preview" className="terminal-compat-target" aria-hidden="true" />
          <span id="market-snapshot" className="terminal-compat-target" aria-hidden="true" />
          <span id="terminal" className="terminal-compat-target" aria-hidden="true" />
          <div className="campaign-runway__pin">
            <header className="campaign-runway__head">
              <div>
                <span className="consumer-eyebrow">The collection</span>
                <h2 id="campaign-runway-title">All twelve, starting with {order[0].name}.</h2>
              </div>
              <div className="campaign-runway__side">
                <p className="campaign-runway__count" aria-hidden="true"><b>{String(position + 1).padStart(2, '0')}</b> / 12</p>
                <div
                  className="campaign-runway__dots"
                  ref={dotsRef}
                  role="group"
                  aria-label="Choose your zodiac sign"
                  onKeyDown={onDotsKeyDown}
                >
                  {SIGNS.map((item, index) => {
                    const selected = item.ticker === active;
                    return (
                      <button
                        key={item.ticker}
                        type="button"
                        className={'campaign-dot' + (selected ? ' is-active' : '')}
                        data-consumer-sign={item.asset.sign}
                        aria-label={`${item.name}, ${consumerSignDateLabel(item)}`}
                        aria-pressed={selected}
                        tabIndex={selected ? 0 : -1}
                        style={{ '--sign': item.hue }}
                        onClick={() => choose(index)}
                      >
                        <img src={`/assets/zodiac-icons/48/${item.asset.sign}.webp`} width="48" height="48" alt="" decoding="async" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </header>
            <div className="campaign-runway__track" ref={trackRef}>
              {order.map((item, index) => (
                <CampaignLook
                  key={item.ticker}
                  item={item}
                  index={index}
                  seasonTicker={seasonTicker}
                  batch={batch}
                  observations={ledgers[item.asset.sign]}
                  active={item.ticker === active}
                  onKeyboardFocus={onKeyboardFocus}
                />
              ))}
            </div>
            <p className="campaign-runway__note">
              <span role="status" aria-live="polite">{status}</span>
              <span>Lines show the last {CAMPAIGN_SPARK_DAYS} daily Registry snapshots.</span>
              <span>Star positions: HYG Database v4.0, CC BY-SA 4.0.</span>
              <a href="/registry/technical/#market-transparency">Data &amp; methodology</a>
            </p>
          </div>
        </section>
      );
    }

    // Under the looks, before buying: what the collection is, in the order
    // a newcomer asks. The static shell carries the same three answers.
    function CampaignAbout() {
      const reveal = useReveal();
      return (
        <section ref={reveal} id="about" className="campaign-about reveal" aria-labelledby="campaign-about-title">
          <h2 id="campaign-about-title">What is Astrofolio?</h2>
          <div className="campaign-about__answers">
            <div className="campaign-about__answer">
              <h3>Twelve tokens, one for each sign.</h3>
              <p>Each Zodiac is a crypto token on the Solana blockchain, with a matching version on Base. You can buy, hold and sell it like other crypto.</p>
            </div>
            <div className="campaign-about__answer">
              <h3>Why the zodiac?</h3>
              <p>Everyone is born under one of the twelve signs, and people have passed them down for 2,400 years, from clay tablets to your phone’s keyboard. A Zodiac makes your sign something you can own, give a friend on their birthday, and keep. <a href="/thesis/">Read the story <span aria-hidden="true">→</span></a></p>
            </div>
            <div className="campaign-about__answer">
              <h3>How do I get one?</h3>
              <p>Pick your sign and tap Buy with Fomo. <a href="#buy">Fomo</a> is a free app for iPhone, Android and the web.</p>
            </div>
          </div>
          <p className="campaign-about__risk">Prices can swing sharply and may fall to zero. Buy only what you can afford to lose.</p>
        </section>
      );
    }

    function CampaignApp() {
      const reveal = useReveal();
      const stageRef = useRef(null);
      const videoRef = useRef(null);
      const playing = useCampaignFilm(videoRef, stageRef, 0.25);
      return (
        <section ref={reveal} id="buy" className="campaign-app reveal" aria-labelledby="campaign-app-title" data-vitrine-rule>
          <div className="campaign-app__head">
            <div>
              <span className="consumer-eyebrow">In the Fomo app</span>
              <h2 id="campaign-app-title">Buy yours in a few taps.</h2>
            </div>
            <div className="campaign-app__lede">
              <p>All twelve Zodiacs are in Fomo, a free trading app for iPhone, Android and the web. Buy with Fomo opens your sign ready to buy; after that you can follow friends and see what they hold.</p>
              <div className="campaign-stores">
                <a className="campaign-store campaign-store--apple" href={FOMO_APP_STORE_URL} rel="external nofollow noopener">
                  <img src="/assets/badges/app-store-en.svg" width="144" height="48" alt="Download on the App Store" loading="lazy" decoding="async" />
                </a>
                <a className="campaign-store campaign-store--google" href={FOMO_PLAY_URL} rel="external nofollow noopener">
                  <img src="/assets/badges/google-play-en.png" width="185" height="71" alt="Get it on Google Play" loading="lazy" decoding="async" />
                </a>
              </div>
              <p className="campaign-app__web">
                <span>On a computer:</span>
                <a href={FOMO_WEB_URL} rel="external nofollow noopener">fomo.family <span aria-hidden="true">↗</span></a>
                <a href="/fomo/">Zodiacs on Fomo <span aria-hidden="true">→</span></a>
              </p>
            </div>
          </div>
          <div className="campaign-app__stage">
            <figure className="campaign-phone campaign-phone--side">
              <div className="campaign-phone__screen">
                <picture>
                  <source srcSet="/assets/fomo/fomo-friends.avif" type="image/avif" />
                  <img src="/assets/fomo/fomo-friends.webp" width="720" height="1397" alt="Fomo's friends list, showing each trader's returns" loading="lazy" decoding="async" />
                </picture>
              </div>
              <figcaption><strong>Follow your friends</strong><span>Add the people you trust and see their buys and sells as they happen.</span></figcaption>
            </figure>
            <figure className="campaign-phone campaign-phone--main" ref={stageRef}>
              <div className="campaign-phone__screen" data-playing={playing ? 'true' : 'false'}>
                <picture>
                  <source srcSet={CAMPAIGN_APP_FOOTAGE.posterAvif} type="image/avif" />
                  <img src={CAMPAIGN_APP_FOOTAGE.posterWebp} width="720" height="1566" alt="The Fomo app listing the twelve Zodiacs" loading="lazy" decoding="async" />
                </picture>
                <video
                  ref={videoRef}
                  className="campaign-phone__video"
                  muted
                  loop
                  playsInline
                  preload="none"
                  disablePictureInPicture
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <source data-src={CAMPAIGN_APP_FOOTAGE.av1} type={'video/mp4; codecs="av01.0.08M.08"'} />
                  <source data-src={CAMPAIGN_APP_FOOTAGE.h264} type="video/mp4" />
                </video>
              </div>
              <figcaption><strong>Open your sign</strong><span>Each sign has its own sheet: the chart, your position, and buy and sell at the foot.</span></figcaption>
            </figure>
            <figure className="campaign-phone campaign-phone--side">
              <div className="campaign-phone__screen">
                <picture>
                  <source srcSet="/assets/fomo/fomo-thesis.avif" type="image/avif" />
                  <img src="/assets/fomo/fomo-thesis.webp" width="720" height="1466" alt="A trader writing a thesis for a Sagittarius position in Fomo" loading="lazy" decoding="async" />
                </picture>
              </div>
              <figcaption><strong>Write your thesis</strong><span>When you buy, say why. It posts with the trade, so followers get the reasoning.</span></figcaption>
            </figure>
          </div>
          <figure className="campaign-alert">
            <picture className="campaign-alert__render">
              <source srcSet="/assets/fomo/fomo-alert-900.avif" type="image/avif" />
              <img src="/assets/fomo/fomo-alert-900.webp" width="900" height="697" alt="A Fomo notification: Capricorn is up 5.98 percent, and 50 top traders bought $88,203.12." loading="lazy" decoding="async" />
            </picture>
            <figcaption><strong>Alerts when your sign moves</strong><span>Fomo sends price alerts like this one for the Zodiacs you watch, so you hear about a move without keeping a chart open.</span></figcaption>
          </figure>
        </section>
      );
    }

    // The bag follows the selected sign from the first screen. On wide
    // screens it rests while the runway (where every look has its own
    // button) fills the screen; on phones the looks carry no buttons, so the
    // bag stays over the runway, follows the look in view, and its sign opens
    // a sheet of all twelve. It rests over the closing notice and footer.
    function CampaignBag({ sign, batch, onPick }) {
      const seasonTicker = useCurrentSeason()?.sign.ticker ?? '';
      const [shown, setShown] = useState(true);
      const phone = useMediaMatch(CAMPAIGN_PHONE_QUERY);
      const sheetRef = useRef(null);
      const openerRef = useRef(null);
      useEffect(() => {
        let frame = 0;
        const paint = () => {
          frame = 0;
          const viewport = window.innerHeight;
          const stage = campaignStageActive();
          const runway = document.getElementById('the-twelve');
          const ending = document.querySelector('.consumer-campaign > .ftr') ?? document.querySelector('#main ~ .zfooter');
          let next = true;
          if (runway && !matchesMedia(CAMPAIGN_PHONE_QUERY)) {
            const rect = runway.getBoundingClientRect();
            const covering = stage
              ? rect.top < viewport * 0.85 && rect.bottom > viewport * 0.15
              : rect.top < viewport * 0.55 && rect.bottom > viewport * 0.45;
            if (covering) next = false;
          }
          if (ending && ending.getBoundingClientRect().top < viewport - 24) next = false;
          setShown(next);
        };
        const schedule = () => {
          if (!frame) frame = window.requestAnimationFrame(paint);
        };
        paint();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        return () => {
          window.cancelAnimationFrame(frame);
          window.removeEventListener('scroll', schedule);
          window.removeEventListener('resize', schedule);
        };
      }, []);
      // The sheet closes itself if the bag rests (the footer came into view).
      useEffect(() => {
        if (!shown && sheetRef.current?.open) sheetRef.current.close();
      }, [shown]);
      const openSheet = () => {
        const sheet = sheetRef.current;
        if (!sheet || sheet.open || typeof sheet.showModal !== 'function') return;
        sheet.showModal();
        document.documentElement.classList.add('has-campaign-sheet');
        window.requestAnimationFrame(() => {
          sheet.querySelector('.campaign-sheet__sign[aria-pressed="true"]')?.focus({ preventScroll: true });
        });
      };
      const closeSheet = () => sheetRef.current?.close();
      const quote = batch.status === 'ok' ? batch.quotes[sign.asset.sign] : null;
      const change = quote ? toFiniteNumber(quote.priceChange24h) : null;
      const direction = change === null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
      const who = (
        <>
          <img src={`/assets/zodiac-icons/128/${sign.asset.sign}.webp`} width="40" height="40" alt="" decoding="async" />
          <span>
            {phone ? (
              <span className="campaign-bag__name">
                <strong>{sign.name}</strong>
                <svg className="campaign-bag__caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                  <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : <strong>{sign.name}</strong>}
            <small>
              {quote ? (
                <>
                  <span>{formatPriceUsd(quote.priceUsd)}</span>
                  {change !== null && <span className={`campaign-bag__move is-${direction}`}>{formatPercent(change)}</span>}
                </>
              ) : <span>{sign.ticker === seasonTicker ? 'In season now' : consumerSignDateLabel(sign)}</span>}
            </small>
          </span>
        </>
      );
      return (
        <>
          <aside
            className={'campaign-bag' + (shown ? '' : ' is-hidden')}
            aria-label={`Buy ${sign.name}`}
            aria-hidden={shown ? undefined : 'true'}
            inert={shown ? undefined : ''}
            data-campaign-bag={sign.asset.sign}
            style={{ '--sign': sign.hue }}
          >
            {phone ? (
              <button
                ref={openerRef}
                type="button"
                className="campaign-bag__who campaign-bag__pick"
                aria-haspopup="dialog"
                aria-label={`${sign.name}. Change sign`}
                onClick={openSheet}
              >
                {who}
              </button>
            ) : <span className="campaign-bag__who">{who}</span>}
            <FomoBuyButton item={sign} source="bag" />
          </aside>
          {phone && (
            <dialog
              ref={sheetRef}
              className="campaign-sheet"
              aria-labelledby="campaign-sheet-title"
              onClick={(event) => { if (event.target === event.currentTarget) closeSheet(); }}
              onClose={() => {
                document.documentElement.classList.remove('has-campaign-sheet');
                openerRef.current?.focus({ preventScroll: true });
              }}
            >
              <div className="campaign-sheet__panel">
                <div className="campaign-sheet__head">
                  <h2 id="campaign-sheet-title">Choose a sign</h2>
                  <button type="button" className="campaign-sheet__close" aria-label="Close" onClick={closeSheet}>
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                      <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="campaign-sheet__grid">
                  {SIGNS.map((item) => (
                    <button
                      key={item.ticker}
                      type="button"
                      className="campaign-sheet__sign"
                      data-sheet-sign={item.asset.sign}
                      aria-pressed={item.ticker === sign.ticker}
                      style={{ '--sign': item.hue }}
                      onClick={() => {
                        onPick(item.ticker);
                        closeSheet();
                      }}
                    >
                      <img src={`/assets/zodiac-icons/128/${item.asset.sign}.webp`} width="44" height="44" alt="" loading="lazy" decoding="async" />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </dialog>
          )}
        </>
      );
    }

    // The hoodie leads the lookbook (owner-approved Campaign order).
    const ASTROFOLIO_SHOP_PRODUCTS = Object.freeze([
      {
        name: 'Astrofolio Hoodie',
        image: '/assets/astrofolio/merch/hoodie-800.webp',
        href: 'https://shop.app/products/9654762504535/astrofolio-hoodie',
      },
      {
        name: 'Astrofolio Cap',
        image: '/assets/astrofolio/merch/cap-800.webp',
        href: 'https://shop.app/products/9654676455767/astrofolio-cap',
      },
      {
        name: 'Astrofolio T-shirt',
        image: '/assets/astrofolio/merch/t-shirt-800.webp',
        href: 'https://shop.app/products/9655740694871/astrofolio-t-shirt',
      },
    ]);

    function ConsumerShop() {
      const reveal = useReveal();
      return (
        <section ref={reveal} id="shop" className="consumer-shop reveal" aria-labelledby="consumer-shop-title" data-vitrine-rule>
          <div className="consumer-shop__copy">
            <span className="consumer-eyebrow">Official merchandise</span>
            <h2 id="consumer-shop-title">Wear your sign.</h2>
            <p>Everyday Astrofolio pieces made for the whole collection.</p>
            <a className="consumer-shop__cta" href="https://shop.app/m/41mzeq7f2h" rel="noopener noreferrer external">
              <span>View the collection</span><span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="consumer-shop__products" aria-label="Featured Astrofolio merchandise">
            {ASTROFOLIO_SHOP_PRODUCTS.map((product, index) => (
              <a key={product.name} className={'consumer-shop__product' + (index === 0 ? ' is-featured' : '')} href={product.href} rel="noopener noreferrer external">
                <img src={product.image} width="800" height="892" alt={product.name} loading="lazy" decoding="async" />
                <span>{product.name}<i aria-hidden="true">↗</i></span>
              </a>
            ))}
          </div>
        </section>
      );
    }

    function ProMasthead({ batch }) {
      const observed = batch.observedAt
        ? new Date(batch.observedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : '';
      const status = observed
        ? `Read ${observed}${batch.stale ? ' · refresh delayed' : batch.refreshing ? ' · refreshing' : ''}`
        : batch.status === 'unavailable' ? 'Live feed unavailable' : 'Reading live markets…';
      return (
        <header className="pro-masthead" aria-labelledby="pro-terminal-title">
          <div className="pro-masthead__identity">
            <div>
              <span>Zodiac markets</span>
              <h1 id="pro-terminal-title">Terminal</h1>
              <p>Live prices, charts, and market activity for all twelve signs.</p>
            </div>
            <div className="pro-masthead__status">
              <strong>Market data only</strong>
              <span role="status" aria-live="polite">{status}</span>
              <a href="/registry/technical/#market-transparency">Data &amp; methodology</a>
            </div>
          </div>
          <nav className="pro-local-nav" aria-label="Terminal sections">
            <a href="#selected">Selected market</a>
            <a href="#market">All markets</a>
            <a href="#briefing">Today&rsquo;s context</a>
            <a href="#research">Research</a>
          </nav>
        </header>
      );
    }

    function ProMarketBoard({ active, setActive, batch }) {
      const initialRank = (() => {
        try {
          const rank = new URLSearchParams(window.location.search).get('rank');
          return TERMINAL_RANKS.has(rank) ? rank : 'marketCap';
        } catch { return 'marketCap'; }
      })();
      const [rankBy, setRankBy] = useState(initialRank);
      const rows = useMemo(() => {
        const field = MARKET_RANKS[rankBy].field;
        return SIGNS.map(item => ({ sign: item, quote: batch.status === 'ok' ? batch.quotes[item.asset.sign] : null }))
          .sort((left, right) => {
            const a = toFiniteNumber(left.quote?.[field]);
            const b = toFiniteNumber(right.quote?.[field]);
            if (a === null && b === null) return left.sign.order - right.sign.order;
            if (a === null) return 1;
            if (b === null) return -1;
            return b - a || left.sign.order - right.sign.order;
          });
      }, [batch, rankBy]);
      const quotes = batch.status === 'ok'
        ? SIGNS.map(item => batch.quotes[item.asset.sign]).filter(Boolean)
        : [];
      const marketCaps = quotes.map(quote => toNonNegativeNumber(quote.marketCap)).filter(value => value !== null);
      const reportedMarketCapSubtotal = marketCaps.length > 0
        ? marketCaps.reduce((sum, value) => sum + value, 0)
        : null;
      const indexedLiquidity = batch.status === 'ok'
        ? toNonNegativeNumber(batch.aggregate?.indexedLiquidityUsd)
        : null;
      const advancing = quotes.filter(quote => (toFiniteNumber(quote.priceChange24h) ?? 0) > 0).length;
      const chooseRank = (rank) => {
        setRankBy(rank);
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('rank', rank);
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        } catch { /* keep UI sorting if URL mutation is unavailable */ }
      };
      const chooseSign = (item, event) => {
        const keyboardSelection = event?.detail === 0;
        setActive(item.ticker);
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('sign', item.asset.sign);
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        } catch { /* keep the selected market if URL mutation is unavailable */ }
        window.requestAnimationFrame(() => {
          const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
          const selected = document.getElementById('selected');
          selected?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
          if (keyboardSelection) {
            const heading = document.getElementById('pro-selected-title');
            heading?.focus({ preventScroll: true });
          }
        });
      };
      const observed = batch.observedAt ? new Date(batch.observedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
      return (
        <section id="market" className="pro-board" aria-labelledby="pro-board-title">
          <header>
            <span className="consumer-section-head__eyebrow">Twelve-token market board</span>
            <h2 id="pro-board-title">All markets.</h2>
            <div>
              <p>Compare every sign. Select one to open its chart above.</p>
              <p className="pro-board__freshness">{observed ? `Updated ${observed}${batch.stale ? ' · refresh delayed' : batch.refreshing ? ' · refreshing' : ''}` : batch.status === 'unavailable' ? 'Live feed unavailable' : 'Reading live markets…'}</p>
            </div>
          </header>
          <div className="pro-board__sort" role="group" aria-label="Sort all markets">
            {Object.entries(MARKET_RANKS).map(([key, option]) => (
              <button key={key} type="button" className={rankBy === key ? 'is-active' : ''} aria-pressed={rankBy === key} onClick={() => chooseRank(key)}>{option.short}</button>
            ))}
          </div>
          <div className="pro-board__scroll">
            <table aria-busy={batch.status === 'loading'}>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Sign</th>
                  <th scope="col">Price</th>
                  <th scope="col" aria-sort={rankBy === 'change' ? 'descending' : 'none'}><button type="button" onClick={() => chooseRank('change')}>24h change</button></th>
                  <th scope="col" aria-sort={rankBy === 'liquidity' ? 'descending' : 'none'}><button type="button" onClick={() => chooseRank('liquidity')}>Indexed liquidity</button></th>
                  <th scope="col" aria-sort={rankBy === 'marketCap' ? 'descending' : 'none'}><button type="button" onClick={() => chooseRank('marketCap')}>Reported market cap</button></th>
                  <th scope="col"><span className="sr-only">Official record</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const item = row.sign;
                  const quote = row.quote;
                  const isActive = item.ticker === active;
                  const rankValue = toFiniteNumber(quote?.[MARKET_RANKS[rankBy].field]);
                  return (
                    <tr key={item.ticker} className={isActive ? 'is-active' : ''} data-market-sign={item.asset.sign} style={{ '--row-sign': item.hue }}>
                      <td className="pro-board__rank">{rankValue === null ? '—' : String(index + 1).padStart(2, '0')}</td>
                      <th scope="row">
                        <button type="button" className="pro-board__sign" aria-pressed={isActive} onClick={(event) => chooseSign(item, event)}>
                          <img src={`/assets/zodiac-icons/48/${item.asset.sign}.webp`} width="32" height="32" alt="" loading="lazy" decoding="async" />
                          <span><strong>{item.name}</strong><small>{item.ticker}</small></span>
                        </button>
                      </th>
                      <td>{quote ? formatPriceUsd(quote.priceUsd) : '—'}</td>
                      <td className={marketChangeClass(quote?.priceChange24h)}>{quote ? formatPercent(quote.priceChange24h) : '—'}</td>
                      <td>{quote ? formatUsdCompact(quote.liquidityUsd) : '—'}</td>
                      <td>{quote?.marketCap !== null && quote?.marketCap !== undefined ? formatUsdCompact(quote.marketCap) : '—'}</td>
                      <td><a href={registryProfilePath(item)} aria-label={`Open the official ${item.name} record`}>Official record ↗</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ol className="pro-board__mobile" aria-busy={batch.status === 'loading'}>
            {rows.map((row, index) => {
              const item = row.sign;
              const quote = row.quote;
              const isActive = item.ticker === active;
              const rankValue = toFiniteNumber(quote?.[MARKET_RANKS[rankBy].field]);
              return (
                <li key={item.ticker} className={isActive ? 'is-active' : ''} data-pro-mobile-market-sign={item.asset.sign} style={{ '--row-sign': item.hue }}>
                  <button type="button" className="pro-board-mobile__select" aria-pressed={isActive} onClick={(event) => chooseSign(item, event)}>
                    <span className="pro-board-mobile__rank">{rankValue === null ? '—' : String(index + 1).padStart(2, '0')}</span>
                    <span className="pro-board-mobile__identity">
                      <img src={`/assets/zodiac-icons/48/${item.asset.sign}.webp`} width="36" height="36" alt="" loading="lazy" decoding="async" />
                      <span><strong>{item.name}</strong><small>{item.ticker}</small></span>
                    </span>
                    <span className="pro-board-mobile__quote">
                      <strong>{quote ? formatPriceUsd(quote.priceUsd) : '—'}</strong>
                      <small className={marketChangeClass(quote?.priceChange24h)}>{quote ? formatPercent(quote.priceChange24h) : '—'}</small>
                    </span>
                  </button>
                  <details className="pro-board-mobile__details">
                    <summary><span className="sr-only">{item.name} </span>Liquidity &amp; record</summary>
                    <dl>
                      <div><dt>Liquidity</dt><dd>{quote ? formatUsdCompact(quote.liquidityUsd) : '—'}</dd></div>
                      <div><dt>Reported market cap</dt><dd>{quote?.marketCap !== null && quote?.marketCap !== undefined ? formatUsdCompact(quote.marketCap) : '—'}</dd></div>
                      <div><dt>24h volume</dt><dd>{quote ? formatUsdCompact(quote.volume24h) : '—'}</dd></div>
                    </dl>
                    <a href={registryProfilePath(item)}>Official record ↗</a>
                  </details>
                </li>
              );
            })}
          </ol>
          {batch.status === 'unavailable' && <p className="pro-board__state" role="status">Live market context is temporarily unavailable. Official records remain available.</p>}
          <dl className="pro-market-health" aria-label="Collection market health" aria-busy={batch.status === 'loading'}>
            <div><dt>Reported market cap subtotal</dt><dd>{formatUsdCompact(reportedMarketCapSubtotal)}</dd><small>{marketCaps.length} of 12 reporting · missing values excluded</small></div>
            <div><dt>Indexed liquidity</dt><dd>{formatUsdCompact(indexedLiquidity)}</dd><small>{batch.status === 'ok' ? `${batch.aggregate?.indexedPoolCount ?? 0} unique Solana pools` : 'Unique Solana pools'}</small></div>
            <div><dt>Signs up today</dt><dd>{batch.status === 'ok' ? `${advancing} / ${quotes.length || 12}` : '—'}</dd><small>24-hour direction</small></div>
          </dl>
          <p className="pro-board__foot">
            Price, 24h change, and valuation use each sign&rsquo;s established SOL pool when one is
            configured; otherwise they use the deepest indexed Solana pool. Per-sign liquidity sums
            distinct pools returned for that mint; the collection total counts each pool address
            once. Market cap is shown only when the source
            reports market cap, never substituted with FDV. DexScreener is independent
            third-party context, may be incomplete, and is not a recommendation. See the{' '}
            <a href="/registry/technical/#market-transparency">method and technical record</a>.
          </p>
        </section>
      );
    }

    function ProSelectedSign({ sign, batch }) {
      const season = useCurrentSeason();
      const history = useRegistryMarketHistory(true);
      const ledger = useMemo(() => marketHistoryForSign(history.data, sign.asset.sign), [history.data, sign.asset.sign]);
      const quote = batch.status === 'ok' ? batch.quotes[sign.asset.sign] : null;
      const pool = quote?.pairAddress || ledger.latest?.deepestPool?.pairAddress || '';
      const rank = marketRankForSign(sign, batch);
      return (
        <section id="selected" className="pro-selected" aria-labelledby="pro-selected-title" style={{ '--active-sign': sign.hue }}>
          <header>
            <div className="pro-selected__identity">
              <img src={`/assets/zodiac-icons/128/${sign.asset.sign}.webp`} width="64" height="64" alt="" decoding="async" />
              <span>
                <small>Selected market · {sign.ticker}</small>
                <h2 id="pro-selected-title" tabIndex={-1}>{sign.name} market</h2>
                <p>{signDateLabel(sign)} · {sign.element} · {sign.archetype}</p>
              </span>
            </div>
            <div className="pro-selected__trust">
              <strong>Official · Solana</strong>
              <span>{rank > 0 ? `#${rank} of 12 by reported market cap` : 'Reported market-cap rank unavailable'}</span>
              <a href={registryProfilePath(sign)}>Official record ↗</a>
            </div>
          </header>
          <dl className="pro-selected__quote" aria-busy={batch.status === 'loading'}>
            <div><dt>Price</dt><dd>{quote ? formatPriceUsd(quote.priceUsd) : '—'}</dd></div>
            <div><dt>24h change</dt><dd className={marketChangeClass(quote?.priceChange24h)}>{quote ? formatPercent(quote.priceChange24h) : '—'}</dd></div>
            <div><dt>Trading liquidity</dt><dd>{quote ? formatUsdCompact(quote.liquidityUsd) : '—'}</dd></div>
            <div><dt>24h volume</dt><dd>{quote ? formatUsdCompact(quote.volume24h) : '—'}</dd></div>
          </dl>
          <div className="pro-selected__grid">
            <div className="pro-selected__chart" aria-label={`${sign.name} selected-sign history`}>
              <SelectedTokenMiniChart key={sign.asset.sign} sign={sign} pool={pool} observations={ledger.observations} />
            </div>
            <SeasonNow season={season} />
          </div>
        </section>
      );
    }

    function ProMarketsGateway({ sign }) {
      if (!REGISTRY_EXCHANGE_ENABLED) return null;
      return (
        <aside className="pro-gateway" data-pro-markets-gateway>
          <span><small>{REGISTRY_EXCHANGE_LANDING_COPY.eyebrow}</small><strong>{REGISTRY_EXCHANGE_LANDING_COPY.action}</strong></span>
          <p>{REGISTRY_EXCHANGE_LANDING_COPY.description}</p>
          <a href={`${REGISTRY_EXCHANGE_PATH}#${sign.asset.sign}`} aria-label={`${REGISTRY_EXCHANGE_LANDING_COPY.action} for ${sign.name}`}>
            Open {sign.name} in the venue route <span aria-hidden="true">↗</span>
          </a>
        </aside>
      );
    }

    function publishedResearchItems(data, activeSlug) {
      const generatedAt = Date.parse(data?.generatedAt || '');
      const now = Number.isFinite(generatedAt) ? generatedAt : Date.now();
      return (Array.isArray(data?.items) ? data.items : [])
        .filter(item => item?.status === 'published'
          && Date.parse(item.visibleAt || item.publishedAt || '') <= now
          && item.url && item.title)
        .sort((left, right) => {
          const leftMatch = Array.isArray(left.signs) && left.signs.includes(activeSlug);
          const rightMatch = Array.isArray(right.signs) && right.signs.includes(activeSlug);
          if (leftMatch !== rightMatch) return leftMatch ? -1 : 1;
          return Date.parse(right.visibleAt || right.publishedAt || '') - Date.parse(left.visibleAt || left.publishedAt || '');
        })
        .slice(0, 3);
    }

    function ProResearchSection({ sign }) {
      const [hostRef, inView] = useInView('420px 0px');
      const research = useRegistryResource(inView, loadRegistryResearch);
      const items = publishedResearchItems(research.data, sign.asset.sign);
      return (
        <section id="research" ref={hostRef} className="pro-research" aria-labelledby="pro-research-title">
          <header>
            <span className="consumer-section-head__eyebrow">Published internal research</span>
            <h2 id="pro-research-title">Research ledger.</h2>
            <p>Reviewed editions related to {sign.name} appear first, followed by the newest published work.</p>
          </header>
          {items.length > 0 ? (
            <div className="pro-research__cards">
              {items.map(item => (
                <article key={item.id} data-research-status={item.status}>
                  <span>{item.kind?.replaceAll('-', ' ') || 'Research'}</span>
                  <h3><a href={item.url}>{item.title}</a></h3>
                  <p>{item.summary}</p>
                  <time dateTime={item.visibleAt || item.publishedAt}>{formatBriefingDate(item.visibleAt || item.publishedAt)}</time>
                </article>
              ))}
            </div>
          ) : research.status === 'idle' || research.status === 'loading' ? (
            <p role="status">Reading the published ledger…</p>
          ) : (
            <div className="pro-research__empty" data-research-empty>
              <strong>The public ledger is waiting for its first reviewed edition.</strong>
              <p>Drafts never appear here.</p>
              <a href="/terminal/research/">Open the research ledger ↗</a>
            </div>
          )}
        </section>
      );
    }

    function ProVerifierLink({ sign }) {
      return (
        <aside id="verify" className="pro-verifier">
          <span><small>Read-only verification</small><strong>Check an exact token address.</strong></span>
          <a href={`/astrofolio/?sign=${sign.asset.sign}#verify`}>Open the address verifier ↗</a>
        </aside>
      );
    }

    function MarketSocialIcon({ network }) {
      if (network === 'x') {
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
          </svg>
        );
      }
      if (network === 'telegram') {
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M21.54 3.18 18.4 19.02c-.24 1.12-.86 1.39-1.75.87l-4.78-3.52-2.31 2.22c-.25.26-.47.47-.96.47l.34-4.87 8.87-8.01c.39-.34-.08-.53-.6-.19L6.25 12.9l-4.72-1.47c-1.03-.32-1.04-1.03.21-1.52L20.2 2.8c.86-.31 1.61.2 1.34.38Z" />
          </svg>
        );
      }
      if (network === 'whatsapp') {
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12.04 2a9.84 9.84 0 0 0-8.42 14.92L2.05 22l5.2-1.52A9.9 9.9 0 1 0 12.04 2Zm0 17.94a8.07 8.07 0 0 1-4.12-1.13l-.3-.18-3.08.9.92-3-.2-.31a8.08 8.08 0 1 1 6.78 3.72Zm4.43-6.04c-.24-.12-1.43-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.62.79-.76.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2a7.3 7.3 0 0 1-1.34-1.67c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.65.3-.22.24-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.72 2.63 4.17 3.69.58.25 1.04.4 1.39.51.58.19 1.12.16 1.54.1.47-.07 1.43-.59 1.64-1.15.2-.57.2-1.05.14-1.15-.06-.1-.22-.16-.47-.28Z" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3v11m0-11 4 4m-4-4L8 7M5 11v8h14v-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    function ConsumerCapitalHeader({ sign }) {
      const batch = useTwelveQuotes(true);
      const quotes = batch.status === 'ok'
        ? SIGNS.map(sign => batch.quotes[sign.asset.sign]).filter(Boolean)
        : [];
      const marketCaps = quotes.map(quote => toFiniteNumber(quote.marketCap)).filter(value => value !== null);
      const liquidities = quotes.map(quote => toFiniteNumber(quote.liquidityUsd)).filter(value => value !== null);
      const advancing = quotes.filter(quote => (toFiniteNumber(quote.priceChange24h) ?? 0) > 0).length;
      const totalMarketCap = marketCaps.reduce((sum, value) => sum + value, 0);
      const totalLiquidity = liquidities.reduce((sum, value) => sum + value, 0);

      return (
        <header
          className="capital-masthead"
          aria-labelledby="consumer-explorer-title"
          style={{ '--active-sign': sign.hue }}
        >
          <div className="capital-masthead__title">
            <span><a href="/registry/">Verified by the Zodiacs Registry</a></span>
            <h1 id="consumer-explorer-title">Astrofolio</h1>
            <p>Twelve signs. Twelve transferable tokens. One live public market.</p>
          </div>
          <div className="capital-pulse" aria-busy={batch.status === 'loading'}>
            <div>
              <span>Indexed market cap</span>
              <strong>{batch.status === 'ok' ? formatUsdCompact(totalMarketCap) : '—'}</strong>
              <small>{marketCaps.length} of 12 reporting</small>
            </div>
            <div>
              <span>Indexed liquidity</span>
              <strong>{batch.status === 'ok' ? formatUsdCompact(totalLiquidity) : '—'}</strong>
              <small>Exact-mint Solana pools</small>
            </div>
            <div>
              <span>24h breadth</span>
              <strong>{batch.status === 'ok' ? `${advancing} / ${quotes.length || 12}` : '—'}</strong>
              <small>Tokens trading higher</small>
            </div>
          </div>
          {REGISTRY_EXCHANGE_ENABLED && (
            <a
              className="capital-advanced"
              href={`${REGISTRY_EXCHANGE_PATH}#${sign.asset.sign}`}
              aria-label={`${REGISTRY_EXCHANGE_LANDING_COPY.action} for ${sign.name}`}
            >
              <span className="capital-advanced__title">
                <small>{REGISTRY_EXCHANGE_LANDING_COPY.eyebrow}</small>
                <strong>{REGISTRY_EXCHANGE_LANDING_COPY.action}</strong>
              </span>
              <span className="capital-advanced__detail">{REGISTRY_EXCHANGE_LANDING_COPY.description}</span>
              <span className="capital-advanced__arrow" aria-hidden="true">
                <svg viewBox="0 0 20 20" focusable="false">
                  <path d="M5 10h9M10.5 6.5 14 10l-3.5 3.5" />
                </svg>
              </span>
            </a>
          )}
        </header>
      );
    }

    function ConsumerMarketSection({ active, setActive, personalSlug, setPersonalSlug }) {
      const reveal = useReveal();
      const [hostRef, inView] = useInView('360px 0px 360px 0px');
      const initialRank = (() => {
        try {
          const requested = new URLSearchParams(window.location.search).get('rank');
          return requested && MARKET_RANKS[requested] ? requested : 'marketCap';
        } catch {
          return 'marketCap';
        }
      })();
      const [rankBy, setRankBy] = useState(initialRank);
      const [retryKey, setRetryKey] = useState(0);
      const [shareState, setShareState] = useState('');
      const [expanded, setExpanded] = useState(false);
      const compactLimit = useCompactMarketLimit();
      const batch = useTwelveQuotes(inView, retryKey);
      const season = useCurrentSeason();

      const rows = useMemo(() => {
        const field = MARKET_RANKS[rankBy].field;
        return SIGNS.map((item) => ({
          sign: item,
          quote: batch.status === 'ok' ? batch.quotes[item.asset.sign] : null,
        })).sort((a, b) => {
          const av = toFiniteNumber(a.quote?.[field]);
          const bv = toFiniteNumber(b.quote?.[field]);
          if (av === null && bv === null) return a.sign.order - b.sign.order;
          if (av === null) return 1;
          if (bv === null) return -1;
          return bv - av || a.sign.order - b.sign.order;
        });
      }, [batch, rankBy]);

      const observed = batch.observedAt
        ? new Date(batch.observedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : null;
      const observedUtc = batch.observedAt
        ? new Date(batch.observedAt).toLocaleString('en-US', {
            timeZone: 'UTC',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }) + ' UTC'
        : '';
      const activeSign = SIGNS.find(item => item.ticker === active) ?? SIGNS[0];
      const metricCoverage = rows.filter(
        row => toFiniteNumber(row.quote?.[MARKET_RANKS[rankBy].field]) !== null,
      ).length;
      const shareReady = batch.status === 'ok' && metricCoverage > 0;
      const visibleRows = expanded ? rows : rows.slice(0, compactLimit);

      const metricValue = (row) => {
        const value = toFiniteNumber(row.quote?.[MARKET_RANKS[rankBy].field]);
        if (value === null) return 'Not indexed';
        return rankBy === 'change' ? formatPercent(value) : formatUsdCompact(value);
      };
      const shareCopy = () => {
        const leaders = rows.filter(row => toFiniteNumber(row.quote?.[MARKET_RANKS[rankBy].field]) !== null).slice(0, 3);
        const list = leaders.map((row, index) => `${index + 1}. ${row.sign.ticker} ${metricValue(row)}`).join('\n');
        return `Terminal · ${MARKET_RANKS[rankBy].label}\n${list}\nRead ${observedUtc} · ${metricCoverage}/12 indexed\nLive market context via DexScreener. Not a recommendation.`;
      };
      const shareUrl = () => {
        const url = new URL('/terminal/', window.location.origin);
        url.searchParams.set('rank', rankBy);
        url.searchParams.set('sign', activeSign.asset.sign);
        url.hash = 'market';
        return url.toString();
      };
      const copyShare = async () => {
        const text = `${shareCopy()}\n${shareUrl()}`;
        try {
          if (navigator.share) {
            try {
              await navigator.share({ title: 'Zodiacs prices and ranks', text: shareCopy(), url: shareUrl() });
              setShareState('Shared.');
              trackAnalytics('registry_market_shared', { rank: rankBy, destination: 'native' });
              return;
            } catch (error) {
              if (error?.name === 'AbortError') return;
              // A platform can expose Web Share while declining a particular
              // payload. Keep the explicit gesture useful with a copy fallback.
            }
          }
          if (!navigator.clipboard?.writeText) throw new Error('clipboard');
          await navigator.clipboard.writeText(text);
          setShareState('Snapshot copied.');
          trackAnalytics('registry_market_shared', { rank: rankBy, destination: 'clipboard' });
        } catch (error) {
          setShareState('Could not share. Choose a social destination.');
        }
      };
      const openSocial = (destination) => {
        const snapshot = shareCopy();
        const url = shareUrl();
        let intent;
        if (destination === 'telegram') {
          intent = new URL('https://t.me/share/url');
          intent.searchParams.set('url', url);
          intent.searchParams.set('text', snapshot);
        } else if (destination === 'whatsapp') {
          intent = new URL('https://wa.me/');
          intent.searchParams.set('text', `${snapshot}\n${url}`);
        } else {
          intent = new URL('https://x.com/intent/post');
          intent.searchParams.set('text', snapshot);
          intent.searchParams.set('url', url);
        }
        window.open(intent.toString(), '_blank', 'noopener,noreferrer');
        const label = destination === 'telegram' ? 'Telegram' : destination === 'whatsapp' ? 'WhatsApp' : 'X';
        setShareState(`${label} share opened.`);
        trackAnalytics('registry_market_shared', { rank: rankBy, destination });
      };
      return (
        <section
          ref={reveal}
          id="market"
          className={'consumer-market reveal' + (expanded ? ' is-expanded' : '')}
          aria-labelledby="consumer-market-title"
          style={{ '--active-sign': activeSign.hue }}
        >
          <header ref={hostRef} className="consumer-market__compact-head">
            <span className="consumer-section-head__eyebrow">Live market board</span>
            <h2 id="consumer-market-title">The twelve, ranked live.</h2>
            <p>Choose a sign to update the chart and research across the page.</p>
          </header>

          <div className="market-board" data-rank={rankBy}>
            <div className="market-board__toolbar">
              <div className="market-board__sort" role="group" aria-label="Rank the Zodiac market by">
                {Object.entries(MARKET_RANKS).map(([key, option]) => (
                  <button
                    key={key}
                    type="button"
                    className="registry-pill registry-pill--segment"
                    aria-pressed={rankBy === key}
                    onClick={() => setRankBy(key)}
                  >{option.short}</button>
                ))}
              </div>
              <div className="market-board__share">
                <button className="registry-pill registry-pill--share market-board__share-primary" type="button" aria-label="Share snapshot" onClick={copyShare} disabled={!shareReady}>
                  <MarketSocialIcon network="share" /><span>Share</span>
                </button>
                <div className="market-board__socials" role="group" aria-label="Share this snapshot on social media">
                  {[
                    ['x', 'X'],
                    ['telegram', 'Telegram'],
                    ['whatsapp', 'WhatsApp'],
                  ].map(([network, label]) => (
                    <button
                      className="registry-pill registry-pill--icon market-board__social"
                      key={network}
                      type="button"
                      aria-label={`Share on ${label}`}
                      title={`Share on ${label}`}
                      disabled={!shareReady}
                      onClick={() => openSocial(network)}
                    ><MarketSocialIcon network={network} /></button>
                  ))}
                </div>
              </div>
            </div>

            <p className="market-board__share-state" role="status" aria-live="polite">{shareState}</p>

            <div className="market-board__meta">
              <span>Ranked by {MARKET_RANKS[rankBy].label}</span>
              <span>{observed ? `Read ${observed}${batch.stale ? ' · refresh delayed' : ''}` : batch.status === 'unavailable' ? 'Live feed unavailable' : 'Reading live markets…'}</span>
            </div>

            {batch.status === 'unavailable' && (
              <div className="market-board__state">
                <p>Live market context is temporarily unavailable. The official records remain available.</p>
                <button className="registry-pill registry-pill--compact" type="button" onClick={() => setRetryKey(value => value + 1)}>Try again</button>
              </div>
            )}
            <ol id="market-ranked-twelve" className="market-board__rows" aria-busy={batch.status === 'loading'}>
                {visibleRows.map((row, index) => {
                  const { sign: item, quote } = row;
                  const isActive = item.ticker === active;
                  const isSeason = item.ticker === season?.sign?.ticker;
                  const isPersonal = item.asset.sign === personalSlug;
                  const rankValue = toFiniteNumber(quote?.[MARKET_RANKS[rankBy].field]);
                  return (
                    <li
                      key={item.ticker}
                      className={'market-row' + (isActive ? ' is-active' : '')}
                      data-market-sign={item.asset.sign}
                      style={{ '--row-sign': item.hue }}
                    >
                      <span className="market-row__rank">{rankValue === null ? '—' : String(index + 1).padStart(2, '0')}</span>
                      <button className="market-row__identity" type="button" onClick={() => setActive(item.ticker)} aria-pressed={isActive}>
                        <img src={`/assets/zodiac-icons/48/${item.asset.sign}.webp`} width="38" height="38" alt="" loading="lazy" decoding="async" />
                        <span><strong>{item.name}</strong><small>{item.ticker}</small></span>
                      </button>
                      <span className="market-row__badges">
                        {isSeason && <span>Season</span>}
                        {isPersonal && <span>Yours</span>}
                      </span>
                      <span className="market-row__metric market-row__metric--price"><small>Price</small><strong>{quote ? formatPriceUsd(quote.priceUsd) : '—'}</strong></span>
                      <span className={'market-row__metric market-row__metric--change' + marketChangeClass(quote?.priceChange24h)}><small>24H</small><strong>{quote ? formatPercent(quote.priceChange24h) : '—'}</strong></span>
                      <span className="market-row__metric market-row__metric--cap"><small>Reported market cap</small><strong>{quote?.marketCap !== null && quote?.marketCap !== undefined ? formatUsdCompact(quote.marketCap) : '—'}</strong></span>
                      <span className="market-row__metric market-row__metric--liq"><small>Liquidity</small><strong>{quote ? formatUsdCompact(quote.liquidityUsd) : '—'}</strong></span>
                      <span className="market-row__actions market-row__actions--record-only">
                        <a className="market-row__record registry-pill registry-pill--record" href={registryProfilePath(item)} aria-label={`Open the official ${item.name} record`}>
                          <span className="market-row__record-label">Official record</span>
                          <span className="market-row__action-orb" aria-hidden="true">↗</span>
                        </a>
                      </span>
                    </li>
                  );
                })}
            </ol>
            <div className="market-board__expand-row">
              <button
                className="registry-pill registry-pill--record market-board__expand"
                type="button"
                aria-expanded={expanded}
                aria-controls="market-ranked-twelve"
                onClick={() => setExpanded(value => !value)}
              >
                <span>{expanded ? 'Show leaders only' : `Show all ${rows.length}`}</span>
                <span className="market-row__action-orb" aria-hidden="true">{expanded ? '↑' : '↓'}</span>
              </button>
              <div className="consumer-market__personal consumer-market__personal--compact">
                <span><small>Your sign</small><strong>{personalSlug ? titleCase(personalSlug) : 'Not chosen'}</strong></span>
                <button
                  className="registry-pill registry-pill--compact"
                  type="button"
                  aria-pressed={personalSlug === activeSign.asset.sign}
                  onClick={() => setPersonalSlug(activeSign.asset.sign)}
                >
                  {personalSlug === activeSign.asset.sign ? `${activeSign.name} saved` : `Save ${activeSign.name}`}
                </button>
              </div>
            </div>
          </div>

          <p className="consumer-market__foot">
            Price, 24h change, and valuation use each sign&rsquo;s established SOL pool when one is
            configured; otherwise they use the deepest indexed Solana pool. Liquidity sums the
            pools returned for each official mint; market cap is shown only when the source
            reports market cap, never substituted with FDV. DexScreener is independent
            third-party context, may be incomplete, and is not a recommendation. See the{' '}
            <a href="/registry/technical/#market-transparency">method and technical record</a>.
          </p>
        </section>
      );
    }

    function visibleBriefingHeadlines(external, activeSlug) {
      const now = Date.now();
      const items = Array.isArray(external?.items) ? external.items : [];
      return items
        .filter(item => {
          const publishedAt = Date.parse(item.publishedAt || '');
          const sourceAllowed = item.sourceType === 'astrology-news' || item.sourceType === 'astronomy';
          return sourceAllowed && Number.isFinite(publishedAt) && publishedAt <= now && item.url && item.title;
        })
        .map(item => ({
          ...item,
          topics: Array.isArray(item.topics) ? item.topics : [],
          signs: Array.isArray(item.signs) ? item.signs : [],
        }))
        .sort((left, right) => {
          const leftRelevant = left.signs.includes(activeSlug) || left.topics.includes(activeSlug);
          const rightRelevant = right.signs.includes(activeSlug) || right.topics.includes(activeSlug);
          if (leftRelevant !== rightRelevant) return leftRelevant ? -1 : 1;
          return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
        })
        .slice(0, 2);
    }

    function formatBriefingDate(value) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return 'Time pending';
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }

    function formatBriefingEventMoment(value) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return 'Time unavailable';
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
      });
    }

    function nextBriefingFactor(entry, nowMs) {
      const seen = new Set();
      return (Array.isArray(entry?.factors) ? entry.factors : [])
        .filter(factor => {
          if (!factor?.id || factor.kind === 'occupancy') return false;
          const at = Date.parse(factor.at || '');
          return Number.isFinite(at) && at > nowMs;
        })
        .sort((left, right) => (
          Date.parse(left.at) - Date.parse(right.at)
          || String(left.id).localeCompare(String(right.id))
        ))
        .find(factor => {
          if (seen.has(factor.id)) return false;
          seen.add(factor.id);
          return true;
        }) || null;
    }

    function formatBriefingCountdown(value, nowMs) {
      const remaining = Date.parse(value || '') - nowMs;
      if (!Number.isFinite(remaining) || remaining <= 0) return 'Now';
      const minutes = Math.max(1, Math.ceil(remaining / 60_000));
      if (minutes < 60) return `in ${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const minuteRemainder = minutes % 60;
      if (hours < 24) return `in ${hours}h${minuteRemainder ? ` ${minuteRemainder}m` : ''}`;
      const days = Math.floor(hours / 24);
      const hourRemainder = hours % 24;
      return `in ${days}d${hourRemainder ? ` ${hourRemainder}h` : ''}`;
    }

    function briefingReadingFor(outlook, sign) {
      const name = sign.name;
      switch (outlook?.signal) {
        case 'supportive':
          return `Traditional astrology reads this as a more constructive backdrop for ${name}; it does not imply a higher token price.`;
        case 'watchful':
          return `Traditional astrology reads this as a higher-friction backdrop for ${name}; market direction remains independent.`;
        case 'charged':
          return `Traditional astrology reads this as an intense event window for ${name}; it does not predict price direction or volatility.`;
        case 'active':
          return `Traditional astrology reads this as heightened focus on ${name}; check whether volume and liquidity actually show greater activity.`;
        case 'steady':
          return `Traditional astrology reads this as moderate focus on ${name}; compare it with market participation without assuming direction.`;
        case 'quiet':
        default:
          return `Traditional astrology treats this as a low-activity window for ${name}; use it as context, not a market forecast.`;
      }
    }

    function BriefingHeadline({ item }) {
      const category = item.sourceType === 'astronomy' ? 'Astronomy' : 'Astrology';
      return (
        <article className="consumer-briefing__headline" data-briefing-headline>
          <a href={item.url} rel="noopener noreferrer external">
            <span>
              <strong>{category} · {item.publisher}</strong>
              <time dateTime={item.publishedAt}>{formatBriefingDate(item.publishedAt)}</time>
            </span>
            <h3>{item.title}</h3>
            <i aria-hidden="true">↗</i>
          </a>
        </article>
      );
    }

    function ConsumerMarketBriefing({ active, sharedMarket = null, includeLegacyAnchors = false }) {
      const reveal = useReveal();
      const [hostRef, inView] = useInView('460px 0px');
      const [sky, setSky] = useState({ status: 'idle' });
      const [skyAttempt, setSkyAttempt] = useState(0);
      const [nowMs, setNowMs] = useState(() => Date.now());
      const fallbackMarket = useTwelveQuotes(!sharedMarket && inView);
      const market = sharedMarket || fallbackMarket;
      const news = useRegistryNews(inView);
      const activeSign = SIGNS.find(item => item.ticker === active) ?? SIGNS[0];

      useEffect(() => {
        if (!inView) return undefined;
        let cancelled = false;
        setSky({ status: 'loading' });
        fetch(REGISTRY_OUTLOOK_URL, {
          cache: 'no-cache',
          headers: { accept: 'application/json' },
        })
          .then((response) => {
            if (!response.ok) throw new Error(`http ${response.status}`);
            return response.json();
          })
          .then((data) => {
            if (!Array.isArray(data?.daily?.signs) || !Array.isArray(data?.weekly?.signs)) {
              throw new Error('invalid outlook payload');
            }
            if (!cancelled) setSky({ status: 'ok', data });
          })
          .catch(() => { if (!cancelled) setSky({ status: 'unavailable' }); });
        return () => { cancelled = true; };
      }, [inView, skyAttempt]);

      useEffect(() => {
        if (!inView) return undefined;
        setNowMs(Date.now());
        const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
        return () => window.clearInterval(timer);
      }, [inView]);

      const dailyEdition = sky.status === 'ok' ? sky.data.daily : null;
      const weeklyEdition = sky.status === 'ok' ? sky.data.weekly : null;
      const dailyOutlook = dailyEdition?.signs?.find(item => item.sign === activeSign.asset.sign) || null;
      const weeklyOutlook = weeklyEdition?.signs?.find(item => item.sign === activeSign.asset.sign) || null;
      const primaryFactor = dailyOutlook?.primaryFactor ?? null;
      const nextFactor = nextBriefingFactor(weeklyOutlook, nowMs);
      const quote = market.status === 'ok' ? market.quotes[activeSign.asset.sign] : null;
      const headlines = visibleBriefingHeadlines(news.data, activeSign.asset.sign);
      const editionReference = dailyEdition?.horizon?.referenceAt
        || (dailyEdition?.date ? `${dailyEdition.date}T12:00:00.000Z` : '');
      const editionIsCurrent = dailyEdition?.date === new Date(nowMs).toISOString().slice(0, 10);
      const coverageComplete = dailyEdition?.coverage?.overall === 'complete'
        && dailyEdition?.coverage?.events === 'complete'
        && dailyEdition?.coverage?.occupancies === 'complete';
      const marketLoading = market.status === 'idle' || market.status === 'loading';
      const skyLoading = sky.status === 'idle' || sky.status === 'loading';
      const newsLoading = news.status === 'idle' || news.status === 'loading';
      const editionMeta = sky.status === 'unavailable'
        ? 'Sky edition unavailable'
        : dailyEdition
          ? `Edition ${formatBriefingDate(editionReference)}`
          : 'Loading today’s edition';
      const marketRead = market.observedAt
        ? new Date(market.observedAt).toLocaleTimeString(undefined, {
            hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
          })
        : '';

      return (
        <section
          ref={reveal}
          id="briefing"
          className="consumer-briefing reveal"
          aria-labelledby="consumer-briefing-title"
          aria-busy={skyLoading || marketLoading || news.status === 'loading'}
          data-briefing-sign={activeSign.asset.sign}
          style={{ '--briefing-sign': activeSign.hue }}
        >
          {includeLegacyAnchors && <span id="research" className="consumer-briefing__legacy-anchor" aria-hidden="true" />}
          {includeLegacyAnchors && <span id="outlook" className="consumer-briefing__legacy-anchor" aria-hidden="true" />}
          <header ref={hostRef} className="consumer-briefing__head">
            <div>
              <span className="consumer-section-head__eyebrow">Market facts · sky context</span>
              <h2 id="consumer-briefing-title">Today’s context</h2>
              <p>Observed market activity and today’s sky context for {activeSign.name}, kept clearly separate.</p>
            </div>
            <div className="consumer-briefing__sign">
              <img src={`/assets/zodiac-icons/128/${activeSign.asset.sign}.webp`} width="58" height="58" alt="" decoding="async" />
              <span>
                <small>Selected token</small>
                <strong>{activeSign.name}</strong>
                <em>{editionMeta}</em>
              </span>
            </div>
          </header>

          {!editionIsCurrent && dailyEdition && (
            <p className="consumer-briefing__notice" role="status">
              Latest published sky edition: {formatBriefingDate(editionReference)}. Treat this as archived context until today’s edition publishes.
            </p>
          )}
          {dailyEdition && !coverageComplete && (
            <p className="consumer-briefing__notice" role="status">
              This edition has partial sky coverage and may omit an event.
            </p>
          )}

          <div className="consumer-briefing__grid">
            <article className="consumer-briefing__lead" data-briefing-event>
              <span className="consumer-briefing__label">
                {primaryFactor?.kind === 'occupancy' ? 'Daily sky reference' : 'Most relevant sky event'}
              </span>
              {sky.status === 'unavailable' ? (
                <div className="consumer-briefing__state">
                  <h3>Sky context unavailable</h3>
                  <p>Market and source feeds load independently.</p>
                  <button className="registry-pill registry-pill--compact" type="button" onClick={() => setSkyAttempt(value => value + 1)}>Retry sky data</button>
                </div>
              ) : (
                <>
                  <h3>{skyLoading ? 'Reading the published sky…' : primaryFactor?.label ?? 'No concentrated event today'}</h3>
                  {primaryFactor?.at && <time dateTime={primaryFactor.at}>{formatBriefingEventMoment(primaryFactor.at)}</time>}
                  <div className="consumer-briefing__reading" data-briefing-reading>
                    <span>Traditional reading</span>
                    <p>{skyLoading ? 'The practical reading will appear with the published edition.' : briefingReadingFor(dailyOutlook, activeSign)}</p>
                  </div>
                </>
              )}
            </article>

            <aside className="consumer-briefing__market" aria-label={`${activeSign.name} observed market data`} data-briefing-market>
              <header>
                <span className="consumer-briefing__label">Observed market</span>
                <small>{marketRead ? `Read ${marketRead}${market.stale ? ' · refresh delayed' : ''}` : marketLoading ? 'Reading live market…' : 'Live read unavailable'}</small>
              </header>
              <dl>
                <div><dt>Price</dt><dd>{quote ? formatPriceUsd(quote.priceUsd) : marketLoading ? '…' : '—'}</dd></div>
                <div><dt>24H change</dt><dd className={quote ? marketChangeClass(quote.priceChange24h) : ''}>{quote ? formatPercent(quote.priceChange24h) : marketLoading ? '…' : '—'}</dd></div>
                <div><dt>Liquidity</dt><dd>{quote ? formatUsdCompact(quote.liquidityUsd) : marketLoading ? '…' : '—'}</dd></div>
                <div><dt>24H volume</dt><dd>{quote ? formatUsdCompact(quote.volume24h) : marketLoading ? '…' : '—'}</dd></div>
              </dl>
              <p>Symbolic context is not a price forecast. Market observations never change the sky reading.</p>
            </aside>

            <aside className="consumer-briefing__next" aria-label={`${activeSign.name} next exact event`} data-briefing-next-event>
              <span className="consumer-briefing__label">Next exact event · 7-day window</span>
              {skyLoading ? (
                <p>Loading the published seven-day schedule…</p>
              ) : sky.status === 'unavailable' ? (
                <p>Next-event schedule unavailable.</p>
              ) : nextFactor ? (
                <>
                  <strong>{nextFactor.label}</strong>
                  <span>
                    <time dateTime={nextFactor.at}>{formatBriefingEventMoment(nextFactor.at)}</time>
                    <em aria-hidden="true">{formatBriefingCountdown(nextFactor.at, nowMs)}</em>
                  </span>
                </>
              ) : (
                <p>No additional exact event is scheduled for {activeSign.name} in the published seven-day window.</p>
              )}
            </aside>
          </div>

          <div className="consumer-briefing__news" aria-label="Independent source headlines" data-briefing-headlines>
            <header>
              <span className="consumer-briefing__label">Independent reporting</span>
              <small>{newsLoading || headlines.length > 0
                ? 'Publisher and publication date shown for every source'
                : 'Fresh source coverage is unavailable'}</small>
            </header>
            <div>
              {headlines.map(item => <BriefingHeadline key={item.id} item={item} />)}
              {newsLoading && [0, 1].map(index => (
                <article className="consumer-briefing__headline consumer-briefing__headline--placeholder" aria-hidden="true" key={index}>
                  <span />
                  <span />
                </article>
              ))}
              {news.status === 'unavailable' && <p className="consumer-briefing__news-state">Source headlines are temporarily unavailable.</p>}
              {news.status === 'ok' && headlines.length === 0 && <p className="consumer-briefing__news-state">No fresh source headlines are available.</p>}
            </div>
          </div>

          <footer className="consumer-briefing__foot">
            <p>Symbolic context—not a price forecast. Astrology has no established predictive relationship with asset prices, and crypto assets can lose all value.</p>
            <a className="registry-pill registry-pill--record consumer-briefing__cta" href={`/terminal/research/?sign=${activeSign.asset.sign}`}>
              <span>Open Markets Research</span><span className="market-row__action-orb" aria-hidden="true">↗</span>
            </a>
          </footer>
        </section>
      );
    }

    function consumerSignDateLabel(sign) {
      const range = parseDateRange(sign?.asset?.metadata?.dateRange);
      if (!range) return sign?.asset?.metadata?.dateRange || '';
      const months = Object.freeze([
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ]);
      const date = (month, day) => `${months[month - 1]} ${day}`;
      return `${date(range.sm, range.sd)} to ${date(range.em, range.ed)}`;
    }

    function VitrinePrice({ sign, batch, live = true }) {
      const quote = batch.status === 'ok' ? batch.quotes[sign.asset.sign] : null;
      const waiting = batch.status === 'loading' || batch.status === 'idle';
      const change = quote ? toFiniteNumber(quote.priceChange24h) : null;
      const direction = change === null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
      const price = quote ? formatPriceUsd(quote.priceUsd) : waiting ? 'Fetching latest price' : 'Price unavailable';
      const movement = quote ? plainMarketMovement(change) : waiting ? 'Updating market context' : 'Movement unavailable';
      return (
        <p
          className={'vitrine-price' + (quote ? '' : ' is-pending')}
          role={live ? 'status' : undefined}
          aria-live={live ? 'polite' : undefined}
          aria-atomic={live ? 'true' : undefined}
        >
          <span className="vitrine-price__figure">{price}</span>
          <span aria-hidden="true">·</span>
          <span className={`vitrine-price__movement is-${direction}`}>{movement}</span>
        </p>
      );
    }

    function ConsumerVerifier({ embedded = false }) {
      const reveal = useReveal();
      const [input, setInput] = useState('');
      const [result, setResult] = useState(null);
      const onSubmit = (event) => {
        event.preventDefault();
        const query = norm(input);
        const chain = /^0x[0-9a-f]{40}$/i.test(query)
          ? 'base'
          : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query) ? 'solana' : 'invalid';
        if (chain === 'invalid') {
          trackAnalytics('verifier_used', { chain, outcome: 'invalid' });
          setResult({ state: 'invalid', queried: query });
          return;
        }
        const hit = lookupAddress(query);
        trackAnalytics('verifier_used', { chain, outcome: hit ? 'official' : 'not_found' });
        setResult(hit
          ? { state: 'official', sign: hit.sign, network: hit.network, queried: query }
          : { state: 'not-found', queried: query });
      };
      const networkLabel = result?.network === 'base' ? 'Base' : 'Solana';
      const Wrapper = embedded ? 'div' : 'section';
      return (
        <Wrapper ref={reveal} id="verify" className={'consumer-verify reveal' + (embedded ? ' is-embedded' : '')} aria-labelledby="consumer-verify-title">
          <header className="consumer-section-head">
            {embedded && <span className="consumer-eyebrow">Address checker</span>}
            {embedded
              ? <h3 id="consumer-verify-title">Verify an address</h3>
              : <h2 id="consumer-verify-title">Check a Zodiac token address</h2>}
          </header>
          <p className="consumer-verify__intro">Paste the token address shown where you found it. We&rsquo;ll tell you whether it appears in the verified list. Never paste a recovery phrase.</p>
          <p className="consumer-verify__distinction">This checks a token address, not a personal account.</p>
          <form className="vrf" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="consumer-vrf-input">Zodiac mint or contract address</label>
            <input
              id="consumer-vrf-input"
              className="vrf__input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              placeholder="Mint or contract address"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (result) setResult(null);
              }}
            />
            <button type="submit" className="vrf__submit">Check address</button>
          </form>
          {result && (
            <div className={'vrf__result vrf__result--' + result.state} role="status" aria-live="polite" data-verifier-state={result.state}>
              {result.state === 'official' && (
                <>
                  <div className="vrf__result-head"><span className="vrf__tick" aria-hidden="true">✓</span><span>{`Official ${result.sign.name} address on ${networkLabel}.`}</span></div>
                  <VrfResultBody sign={result.sign} network={result.network} queried={result.queried} />
                </>
              )}
              {result.state === 'not-found' && (
                <div className="vrf__result-head"><span className="vrf__cross" aria-hidden="true">×</span><span>This address isn&rsquo;t in the official Zodiac list.</span></div>
              )}
              {result.state === 'invalid' && (
                <div className="vrf__result-head"><span className="vrf__cross" aria-hidden="true">×</span><span>That doesn&rsquo;t look like a complete token address.</span></div>
              )}
            </div>
          )}
        </Wrapper>
      );
    }

    function ConsumerRegistryGuide({ sign }) {
      const reveal = useReveal();
      const origin = sign.representations.solana.address;
      const counterpart = sign.representations.base.address;
      return (
        <section ref={reveal} id="registry" className="consumer-registry-guide campaign-record reveal" aria-labelledby="consumer-registry-title" data-vitrine-rule style={{ '--record-sign': sign.hue }}>
          <header className="consumer-section-head">
            <span className="consumer-eyebrow">The official record</span>
            <h2 id="consumer-registry-title">Check the address, not the name.</h2>
          </header>
          <div id="identity" className="campaign-record__identity">
            <p className="campaign-record__label">
              <img src={`/assets/zodiac-icons/48/${sign.asset.sign}.webp`} width="28" height="28" alt="" loading="lazy" decoding="async" />
              <span>{sign.name} · Solana origin</span>
            </p>
            <p className="campaign-record__address"><code>{origin.slice(0, 4)}<span>{origin.slice(4, -4)}</span>{origin.slice(-4)}</code></p>
            <p className="campaign-record__meta">
              <span>Base counterpart <code>{truncateAddress(counterpart, 6, 4)}</code></span>
              <a href={registryProfilePath(sign)}>Open the complete {sign.name} record <span aria-hidden="true">→</span></a>
            </p>
          </div>
          <div className="campaign-record__grid">
            <div className="campaign-record__copy">
              <p>Names and tickers can be copied. The Registry identifies each Zodiac by its complete address: a Solana origin and an official Base counterpart, 24 in all. Paste one here to compare.</p>
              <details className="consumer-disclosure">
                <summary>Why the address matters</summary>
                <div className="consumer-disclosure__body">
                  <p>A familiar name or ticker is not enough. Verification compares the complete address with the published Registry.</p>
                  <a href="/registry/technical/#records-networks">See how records work</a>
                </div>
              </details>
            </div>
            <ConsumerVerifier embedded />
          </div>
        </section>
      );
    }

    function ConsumerStory() {
      const reveal = useReveal();
      return (
        <section ref={reveal} id="thesis" className="consumer-story reveal" aria-labelledby="consumer-story-title">
          <article className="consumer-thesis">
            <a className="consumer-thesis__link" href="/thesis/">
              <div className="consumer-thesis__visual">
                <picture>
                  <source srcSet="/assets/art/zodiac-clock-1280.avif" type="image/avif" />
                  <img
                    src="/assets/art/zodiac-clock-1280.jpg"
                    width="1280"
                    height="720"
                    alt="Astronomical clock encircled by the twelve zodiac signs"
                    loading="lazy"
                    decoding="async"
                  />
                </picture>
                <span className="consumer-thesis__line" aria-hidden="true">Symbol · record · identity</span>
              </div>
              <div className="consumer-purpose__essay">
                <span className="consumer-eyebrow">The Twelve</span>
                <h2 id="consumer-story-title">The story behind the collection.</h2>
                <p>The twelve signs have travelled through calendars, charts, jewellery, and screens. Astrofolio gives their token records one public home.</p>
                <span className="consumer-purpose__cta consumer-story__cta"><span>Read the story</span><span className="consumer-purpose__arrow" aria-hidden="true">→</span></span>
              </div>
            </a>
          </article>
        </section>
      );
    }

    function ConsumerCabinet() {
      const reveal = useReveal();
      const cabinetSample = Object.freeze({
        aries: { finish: 'crown', numeral: 'V', count: '×12' },
        cancer: { finish: 'pastel', numeral: 'I' },
        leo: { finish: 'bronze', numeral: 'II' },
        scorpio: { finish: 'silver', numeral: 'III' },
        aquarius: { finish: 'gold', numeral: 'IV', count: '×3' },
      });
      const CabinetSurface = REGISTRY_AURA_ENABLED ? 'a' : 'div';
      return (
        <section ref={reveal} id="cabinet" className="consumer-cabinet-section reveal" aria-labelledby="consumer-cabinet-title">
          <article className="consumer-collection" data-registry-collection>
            <CabinetSurface className="consumer-collection__link" {...(REGISTRY_AURA_ENABLED ? { href: REGISTRY_AURA_PATH } : {})}>
              <div className="consumer-collection__copy">
                <small className="consumer-eyebrow">A public collection</small>
                <h2 id="consumer-cabinet-title">Cabinet of Twelve</h2>
                <p>See which signs a public address holds. No wallet connection is required.</p>
              </div>
              <div className="consumer-collection__art" aria-hidden="true">
                <div className="consumer-cabinet">
                  <div className="consumer-cabinet__seats">
                    {SIGNS.map((item, index) => {
                      const edition = cabinetSample[item.asset.sign];
                      const occupied = Boolean(edition);
                      const goldArtwork = edition?.finish === 'gold' || edition?.finish === 'crown';
                      const imagePath = goldArtwork
                        ? `/assets/cabinet-materials/gold/${item.asset.sign}`
                        : `/assets/zodiac-icons/128/${item.asset.sign}`;
                      return (
                        <span
                          key={item.ticker}
                          className={'consumer-cabinet__seat' + (occupied ? ` is-filled is-${edition.finish}` : ' is-empty')}
                          style={{ '--seat-i': index }}
                          data-cabinet-sample-finish={edition?.finish}
                        >
                          <span className="consumer-cabinet__number">{String(index + 1).padStart(2, '0')}</span>
                          {occupied ? (
                            <>
                              <picture>
                                <source srcSet={`${imagePath}.avif`} type="image/avif" />
                                <img src={`${imagePath}.webp`} width="128" height="128" alt="" loading="lazy" decoding="async" />
                              </picture>
                              <span className="consumer-cabinet__edition">{edition.numeral}</span>
                              {edition.count && <span className="consumer-cabinet__count">{edition.count}</span>}
                            </>
                          ) : <span className="consumer-cabinet__glyph">{item.symbol}</span>}
                        </span>
                      );
                    })}
                  </div>
                  <span className="consumer-cabinet__plaque"><strong>5 / 12</strong><span>Curator&rsquo;s sample</span></span>
                </div>
              </div>
              {REGISTRY_AURA_ENABLED
                ? <span className="consumer-purpose__cta consumer-collection__cta"><span>Open the Cabinet</span><span className="consumer-purpose__arrow" aria-hidden="true">→</span></span>
                : <span className="consumer-collection__preview">Collection preview</span>}
            </CabinetSurface>
          </article>
        </section>
      );
    }

    const CONSUMER_FAQS = [
      {
        q: 'What is Astrofolio?',
        a: 'Astrofolio is the collection of twelve official Zodiac tokens—one for each sign—with its own design and public Registry record.'
      },
      {
        q: 'How do I know a Zodiac is official?',
        a: 'Compare the complete token address with the published Registry. A name or ticker alone is not enough.'
      },
      {
        q: 'Why does each sign have Solana and Base addresses?',
        a: 'Each Zodiac began on Solana and has an official Base counterpart. Both verified addresses appear in the same Registry record.'
      },
      {
        q: 'Do I need a wallet to browse?',
        a: 'No. You can browse the collection, see market context, and verify addresses without connecting a wallet.'
      },
      {
        q: 'Where can I find Astrofolio merchandise?',
        a: 'Browse the Astrofolio Shop for clothing inspired by the twelve signs.'
      },
      {
        q: 'What are the risks?',
        a: 'Zodiac tokens are speculative and can be volatile or hard to sell. Prices can fall to zero, and wallet mistakes or scams can cause permanent loss.'
      },
      {
        q: 'What is the Terminal?',
        a: 'The Terminal is the market desk for all twelve Zodiacs, with live prices, liquidity, charts, season context, research, and trading. Jupiter Ultra supplies the executable route and transaction; your wallet reviews, approves, and signs.'
      }
    ];

    function ConsumerFaq() {
      const reveal = useReveal();
      return (
        <section ref={reveal} id="faq" className="consumer-faq reveal" aria-labelledby="consumer-faq-title">
          <header className="consumer-section-head">
            <h2 id="consumer-faq-title">Questions</h2>
          </header>
          <div className="consumer-faq__list">
            {CONSUMER_FAQS.map(item => (
              <details className="consumer-faq__item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    }

    function ConsumerMarketGateway({ batch, activeTicker }) {
      const reveal = useReveal();
      const live = batch.status === 'ok';
      const waiting = batch.status === 'loading' || batch.status === 'idle';
      const indexedCount = live
        ? SIGNS.filter(item => batch.quotes?.[item.asset.sign]).length
        : 0;
      const activeSign = SIGNS.find(item => item.ticker === activeTicker) ?? SIGNS[0];
      const rows = useMemo(() => SIGNS
        .map((item) => {
          const quote = live ? batch.quotes[item.asset.sign] : null;
          return {
            item,
            marketCap: toFiniteNumber(quote?.marketCap),
            change: toFiniteNumber(quote?.priceChange24h),
          };
        })
        .sort((left, right) => {
          if (left.marketCap === null && right.marketCap === null) return left.item.order - right.item.order;
          if (left.marketCap === null) return 1;
          if (right.marketCap === null) return -1;
          return right.marketCap - left.marketCap || left.item.order - right.item.order;
        }), [batch, live]);
      const leadingCap = rows.find(row => row.marketCap !== null)?.marketCap ?? 0;
      const observed = batch.observedAt
        ? new Date(batch.observedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : '';
      const coverage = live && indexedCount < SIGNS.length ? ` · ${indexedCount}/12` : '';
      const status = live
        ? `${batch.stale ? 'Delayed' : batch.refreshing ? 'Refreshing' : 'Live'}${coverage}${observed ? ` · ${observed}` : ''}`
        : waiting ? 'Ranking live…' : 'Market data unavailable';
      return (
        <section
          ref={reveal}
          id="market-layer"
          className="consumer-market-gateway reveal"
          aria-labelledby="consumer-market-gateway-title"
        >
          <article className="consumer-market-gateway__shell">
            <div className="consumer-market-gateway__visual">
              <div className="consumer-market-gateway__status">
                <span>The Twelve / leaderboard</span>
                <span role="status" aria-live="polite">{status}</span>
              </div>
              <div className="consumer-market-leaderboard">
                <div className="consumer-market-leaderboard__labels" aria-hidden="true">
                  <span>Rank</span><span>Sign</span><span>Market cap</span><span>24h</span><span />
                </div>
                <ol role="list" aria-label="Zodiac market-cap leaderboard">
                  {rows.map(({ item, marketCap, change }, index) => {
                    const active = item.ticker === activeTicker;
                    const direction = change === null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
                    const ranked = live && marketCap !== null;
                    const share = leadingCap > 0 && marketCap !== null ? marketCap / leadingCap : 0;
                    const rowLabel = ranked
                      ? `Rank ${index + 1}, ${item.name}, market cap ${formatUsdCompact(marketCap)}${change !== null ? `, 24 hour change ${formatPercent(change)}` : ''}`
                      : `${item.name}, market data unavailable`;
                    const rowClass = [active ? 'is-active' : '', ranked && index < 3 ? 'is-podium' : ''].filter(Boolean).join(' ') || undefined;
                    return (
                      <li key={item.ticker} className={rowClass}>
                        <a
                          href={`/astrofolio/?sign=${item.asset.sign}#consumer-sign-preview`}
                          style={{ '--market-share': share }}
                          aria-current={active ? 'true' : undefined}
                          aria-label={rowLabel}
                          onClick={() => trackAnalytics('astrofolio_leaderboard_select', { sign: item.asset.sign, rank: live && marketCap !== null ? index + 1 : null })}
                        >
                          <span className="consumer-market-leaderboard__rank">{live && marketCap !== null ? String(index + 1).padStart(2, '0') : '—'}</span>
                          <span className="consumer-market-leaderboard__identity">
                            <picture className="consumer-market-leaderboard__icon" aria-hidden="true">
                              <source srcSet={`/assets/zodiac-icons/48/${item.asset.sign}.avif`} type="image/avif" />
                              <img src={`/assets/zodiac-icons/48/${item.asset.sign}.webp`} width="34" height="34" alt="" decoding="async" />
                            </picture>
                            <span><strong>{item.name}</strong><small>{item.ticker}</small></span>
                          </span>
                          <span className="consumer-market-leaderboard__metric"><small>Market cap</small><strong>{live ? formatUsdCompact(marketCap) : '—'}</strong></span>
                          <span className={`consumer-market-leaderboard__move is-${direction}`}><small>24h</small><strong>{live ? formatPercent(change) : '—'}</strong></span>
                          <span className="consumer-market-leaderboard__arrow" aria-hidden="true">›</span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="consumer-market-gateway__routes">
                <span><small>Ranking</small><strong>Reported market cap</strong></span>
                <span><small>Source</small><strong>Dex Screener · Solana</strong></span>
              </div>
            </div>
            <div className="consumer-market-gateway__copy">
              <span className="consumer-market-gateway__eyebrow">{batch.stale ? 'Latest leaderboard' : 'Live leaderboard'}</span>
              <h2 id="consumer-market-gateway-title">Who&rsquo;s leading today?</h2>
              <p>{batch.stale ? 'The latest available ranking of the Twelve by reported market cap.' : 'A simple live ranking of the Twelve by reported market cap.'} Tap any row to jump back to that Zodiac.</p>
              <div className="consumer-market-gateway__actions">
                <a className="consumer-market-gateway__action is-secondary" href="/registry/technical/#market-transparency">
                  <span>How ranking works</span><span aria-hidden="true">→</span>
                </a>
                <a className={'consumer-market-gateway__action ' + (REGISTRY_EXCHANGE_ENABLED ? 'is-secondary' : 'is-primary')} href="/terminal/?rank=marketCap">
                  <span>View full market</span><span aria-hidden="true">↗</span>
                </a>
                {/* Venue-route discovery entry, authorized by the 2026-08-31
                    owner addendum: rides the same exchange flag and marker as
                    the /terminal/ gateway, so committed pages (marker 0) never
                    render it and the one rollback flag removes it everywhere. */}
                {REGISTRY_EXCHANGE_ENABLED && (
                  <a
                    className="consumer-market-gateway__action is-primary"
                    href={`${REGISTRY_EXCHANGE_PATH}#${activeSign.asset.sign}`}
                    aria-label={`Open the Terminal venue route to trade ${activeSign.name}`}
                    onClick={() => trackAnalytics('astrofolio_venue_route_open', { sign: activeSign.asset.sign })}
                  >
                    <span>Trade {activeSign.name}</span><span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
              <p className="consumer-market-gateway__note">Market data comes from an independent index and can be delayed, incomplete, unavailable, or wrong. It is context, not a recommendation.</p>
            </div>
          </article>
        </section>
      );
    }

    function TechnicalRecordsSection() {
      const records = SIGNS.flatMap(sign => sign.asset.representations);
      return (
        <section
          id="records-networks"
          className="technical-group technical-records"
          aria-labelledby="technical-records-title"
          data-technical-records
          data-record-count={SIGNS.length}
          data-representation-count={records.length}
        >
          <header className="technical-group__head">
            <span>01</span>
            <div>
              <h2 id="technical-records-title">Records and networks</h2>
              <p>Twelve sign identities. Twenty-four official representations. One canonical public file.</p>
            </div>
          </header>

          <div className="technical-records__table-wrap">
            <table className="technical-records__table">
              <caption>Official Solana and Base addresses for the twelve Zodiacs</caption>
              <thead>
                <tr><th scope="col">Sign</th><th scope="col">Solana · native</th><th scope="col">Base · bridged</th></tr>
              </thead>
              <tbody>
                {SIGNS.map(sign => (
                  <tr key={sign.ticker} data-technical-sign={sign.asset.sign}>
                    <th scope="row">
                      <img
                        src={`/assets/zodiac-icons/48/${sign.asset.sign}.webp`}
                        width="32"
                        height="32"
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                      <span>{sign.name}</span>
                    </th>
                    <td data-registry-address="solana" data-technical-representation="solana">
                      <CopyChip
                        text={sign.representations.solana.address}
                        display={truncateAddress(sign.representations.solana.address, 7, 6)}
                      />
                    </td>
                    <td data-registry-address="base" data-technical-representation="base">
                      <CopyChip
                        text={sign.representations.base.address}
                        display={truncateAddress(sign.representations.base.address, 7, 6)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="technical-records__notes">
            <p>
              Solana is the canonical origin. Each Base address is the official bridged ERC-20
              representation recorded through Wormhole and points back to its Solana mint.
            </p>
            <nav aria-label="Registry record resources">
              <a href="/registry/zodiacs.registry.json">Open registry JSON</a>
              <a href="https://github.com/zodiacs-org/sdk" rel="noopener noreferrer">View the SDK source</a>
              <a href="/disclosure/#origin">Read provenance</a>
            </nav>
          </div>
        </section>
      );
    }

    function TechnicalEvidenceLinks() {
      return (
        <nav className="technical-evidence" aria-label="Safety and evidence resources">
          <a href="/disclosure/"><strong>Disclosure</strong><span>Methods, relationships, and risk</span></a>
          <a href="/archive/"><strong>Archive</strong><span>Dated public history</span></a>
          <a href="/registry/zodiacs.registry.json"><strong>Canonical JSON</strong><span>The machine-readable record</span></a>
          <a href="/sdk/"><strong>SDK documentation</strong><span>Read-only developer reference</span></a>
        </nav>
      );
    }

    const FOOTER_EXPLORE = [
      ['/', 'Astrology'],
      ['/astrofolio/', 'Astrofolio'],
      ['/registry/', 'Official Registry'],
      ['/thesis/', 'Thesis'],
      ['/archive/', 'Archive'],
    ];
    const FOOTER_TRUST = [
      ['/astrofolio/#verify', 'Verify a token'],
      ['/registry/technical/', 'Methodology'],
      ['/disclosure/', REGISTRY_DISCLOSURE_LABEL],
      ['/sdk/', 'SDK'],
    ];
    const FOOTER_CHANNELS = [
      ['https://x.com/astrofoliosol', 'X'],
      ['https://www.instagram.com/astrofolioonsol/', 'Instagram'],
      ['https://tiktok.com/@astrofolio', 'TikTok'],
      ['https://t.me/astrofoliosol', 'Telegram'],
    ];
    const FOOTER_LOCALES = [
      ['/', 'en', 'en', 'English'],
      ['/es/', 'es', 'es', 'Español'],
      ['/pt/', 'pt-BR', 'pt-BR', 'Português (Brasil)'],
      ['/fr/', 'fr', 'fr', 'Français'],
      ['/it/', 'it', 'it', 'Italiano'],
    ];
    const FOOTER_YEAR = new Date().getUTCFullYear();

    function FooterLinks({ links, external = false }) {
      return links.map(([href, label]) => (
        <a key={`${href}-${label}`} href={href} rel={external ? 'noopener noreferrer' : undefined}>{label}</a>
      ));
    }

    function SiteEnd({ tagline, exploreLinks = FOOTER_EXPLORE, trustLinks = FOOTER_TRUST }) {
      return (
        <footer className="zfooter zfooter--static">
          <div className="zfooter__inner">
            <div className="zfooter__lead">
              <div>
                <a className="zfooter__brand" href="/">
                  <img className="zfooter__brand-mark" src="/assets/app-icons/v3/favicon.svg" width="26" height="26" alt="" loading="lazy" decoding="async" />
                  <span className="zfooter__brand-name">Zodiacs</span><span className="zfooter__brand-tld">.org</span>
                </a>
                <p className="zfooter__tag">{tagline}</p>
              </div>
              <button className="zfooter__guide" type="button" data-assistant-open data-footer-guide aria-haspopup="dialog">
                <img src="/assets/guide-avatar.webp" width="32" height="32" alt="" loading="lazy" decoding="async" />
                <span>Guide</span>
              </button>
            </div>

            <div className="zfooter__directory">
              <nav className="zfooter__group" aria-label="Explore">
                <span className="zfooter__label">Explore</span>
                <div className="zfooter__links"><FooterLinks links={exploreLinks} /></div>
              </nav>
              <nav className="zfooter__group" aria-label="Trust and policies">
                <span className="zfooter__label">Trust</span>
                <div className="zfooter__links"><FooterLinks links={trustLinks} /></div>
              </nav>
              <nav className="zfooter__group zfooter__group--wide" aria-label="Official channels">
                <span className="zfooter__label">Follow</span>
                <div className="zfooter__links"><FooterLinks links={FOOTER_CHANNELS} external /></div>
              </nav>
              <nav className="zfooter__group zfooter__twelve" aria-label="The twelve zodiac signs">
                <span className="zfooter__label">The Twelve</span>
                <div className="zfooter__signs">
                  {SIGNS.map((sign) => (
                    <a className="zfooter__sign" key={sign.asset.sign} href={`/${sign.asset.sign}/`} aria-label={sign.name} title={sign.name}>
                      <img src={`/assets/zodiac-icons/48/${sign.asset.sign}.webp?surface=site-footer`} width="25" height="25" alt="" loading="lazy" decoding="async" />
                      <span className="zfooter__visually-hidden">{sign.name}</span>
                    </a>
                  ))}
                </div>
              </nav>
            </div>

            <div className="zfooter__language">
              <span className="zfooter__label" id="runtime-footer-language-label">Language</span>
              <nav className="zfooter__locales" aria-labelledby="runtime-footer-language-label">
                {FOOTER_LOCALES.map(([href, hreflang, lang, label], index) => (
                  index === 0
                    ? <span className="zfooter__locale" key={href} lang={lang} aria-current="page">{label}</span>
                    : <a className="zfooter__locale" key={href} href={href} hrefLang={hreflang} lang={lang}>{label}</a>
                ))}
              </nav>
            </div>

            <div className="zfooter__colophon">
              <p className="zfooter__copyright">© {FOOTER_YEAR} Zodiacs.org</p>
              <nav className="zfooter__meta" aria-label="Legal">
                <span className="zfooter__label">Legal</span>
                <div className="zfooter__meta-links"><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></div>
              </nav>
              <nav className="zfooter__meta" aria-label="More">
                <span className="zfooter__label">More</span>
                <div className="zfooter__meta-links"><a href="/widgets/">Widgets</a><a href="/feeds/horoscopes.xml">RSS</a></div>
              </nav>
              <div className="zfooter__meta zfooter__credits">
                <span className="zfooter__label">Data &amp; licenses</span>
                <p>Place data: <a href="https://www.geonames.org/" rel="noopener noreferrer">GeoNames</a> · CC BY 4.0</p>
                <p>Typefaces licensed under <a href="/fonts/OFL-instrument-sans.txt">SIL OFL 1.1</a></p>
                <p>
                  Registry record: Zodiac assets originated {REGISTRY_ESTABLISHED} ·{' '}
                  {REGISTRY_ESTABLISHMENT_PROVENANCE_URL
                    ? <a href={REGISTRY_ESTABLISHMENT_PROVENANCE_URL} rel="noopener nofollow">{REGISTRY_ESTABLISHMENT_PROVENANCE_LABEL}</a>
                    : <a href="/disclosure/#origin">{REGISTRY_PROVENANCE_PENDING_LABEL}</a>}
                </p>
              </div>
            </div>
          </div>
        </footer>
      );
    }

    function TechnicalFooter() {
      const exploreLinks = [
        ['/registry/', 'Zodiacs Registry'],
        ['#records-networks', 'Records'],
        ['#market-transparency', 'Market'],
        ['#onchain-access', 'Access'],
        ['#builders', 'Builders'],
        ['#security', 'Safety'],
      ];
      return <SiteEnd tagline="The addresses, networks, and evidence behind the official Registry." exploreLinks={exploreLinks} />;
    }

    function MarketVenueNotice() {
      return (
        <div className="ftr">
          <aside
            className="ftr__market-notice"
            role="note"
            aria-labelledby="terminal-market-notice-title"
            data-terminal-market-notice
          >
            <span className="ftr__market-notice-label" id="terminal-market-notice-title">Market &amp; venue notice</span>
            <div className="ftr__market-notice-copy">
              <p>
                Zodiac tokens are speculative, thinly traded digital assets. Prices can be
                volatile, liquidity may disappear, and you could lose all money used to acquire
                one. Astrology has no established predictive relationship with asset prices.
              </p>
              <p>
                Zodiacs.org provides the Terminal interface and public Registry; it does not
                operate a DEX, exchange, broker, or custodial service. When trading is available,
                Jupiter, an independent third-party liquidity aggregator, supplies the executable
                quote, builds and submits the transaction, and charges any venue fee shown; your
                wallet reviews, approves, and signs. Zodiacs.org holds no keys or funds, cannot
                reverse transactions, and receives no trading or referral compensation.
                References to Jupiter do not imply affiliation or endorsement.
              </p>
              <p>
                Information is for informational purposes only and is not an offer or solicitation,
                an investment recommendation or trading strategy, or accounting, legal, tax, or
                financial advice. Third-party services may not be available in all regions. Verify
                the official address, network, amount, fees, and destination before signing.
              </p>
            </div>
          </aside>
        </div>
      );
    }

    // ──────────────────────────────────────────────────────────────
    // Root
    // ──────────────────────────────────────────────────────────────
    const LEGACY_TECHNICAL_HASHES = {
      pulse: 'market-transparency',
      standings: 'market-transparency',
      'onchain-access': 'access-third-parties',
      builders: 'builder-tools',
      'built-with-zodiacs': 'builder-tools',
      sdk: 'builder-tools',
      security: 'safety-evidence'
    };

    function Zodiacs() {
      const technical = REGISTRY_VIEW === 'technical';
      const pro = REGISTRY_VIEW === 'terminal-pro';
      const [activeTicker, setActiveTicker] = useState(
        () => {
          try {
            const requested = new URLSearchParams(window.location.search).get('sign') || '';
            const shared = validTerminalSign(requested);
            if (shared) return shared.ticker;
            const saved = window.localStorage.getItem('zodiacs:today-sun-sign:v1');
            const personal = validTerminalSign(saved);
            if (personal) return personal.ticker;
          } catch { /* malformed query: season remains the safe default */ }
          return currentSeason()?.sign.ticker ?? SIGNS[0].ticker;
        }
      );
      // The runway starts from the sign the visit opened with; later
      // selections move along it rather than reordering it.
      const [anchorTicker] = useState(activeTicker);
      const sign = useMemo(
        () => SIGNS.find(s => s.ticker === activeTicker) ?? SIGNS[0],
        [activeTicker]
      );
      // The bag's sheet chooses a sign from anywhere on the page; the runway
      // follows it without moving the page.
      const pickFromBag = useCallback((ticker) => {
        const next = SIGNS.find((item) => item.ticker === ticker);
        if (!next) return;
        setActiveTicker(next.ticker);
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('sign', next.asset.sign);
          window.history.replaceState(null, '', `${url.pathname}?${url.searchParams}${url.hash}`);
        } catch { /* malformed URL: the choice still stands */ }
        trackAnalytics('registry_sign_selected', { sign: next.asset.sign, source: 'consumer_bag' });
      }, []);
      const proMarket = useTwelveQuotes(pro);
      const consumerMarket = useTwelveQuotes(!technical && !pro);

      useEffect(() => {
        if (technical) trackAnalytics('registry_technical_visit');
        else if (!pro) trackAnalytics('registry_visit');
        const onClick = (event) => {
          const link = event.target.closest?.('a[href]');
          if (!link) return;
          const href = link.getAttribute('href') ?? '';
          const destination = href.startsWith('/sdk/')
            ? 'docs'
            : href.includes('npmjs.com/package/@zodiacs/sdk') ? 'npm'
              : href.includes('github.com/zodiacs-org/sdk') ? 'github' : null;
          if (destination) trackAnalytics('sdk_click', { source: 'registry', destination });
        };
        document.addEventListener('click', onClick);
        return () => document.removeEventListener('click', onClick);
      }, [technical, pro]);

      useEffect(() => {
        if (pro) return undefined;
        const redirectLegacyHash = () => {
          let id = '';
          try {
            id = decodeURIComponent(window.location.hash.slice(1));
          } catch {
            return;
          }
          const technicalDestination = LEGACY_TECHNICAL_HASHES[id];
          if (technicalDestination) {
            window.location.replace(`/registry/technical/${window.location.search}#${encodeURIComponent(technicalDestination)}`);
            return;
          }
          if (technical) return;
          const proDestination = TERMINAL_LEGACY_PRO_HASHES[id];
          if (!proDestination) return;
          const clean = new URLSearchParams();
          try {
            const incoming = new URLSearchParams(window.location.search);
            const incomingSign = validTerminalSign(incoming.get('sign'));
            const incomingRank = incoming.get('rank');
            if (incomingSign) clean.set('sign', incomingSign.asset.sign);
            if (TERMINAL_RANKS.has(incomingRank)) clean.set('rank', incomingRank);
          } catch { /* malformed query: redirect without it */ }
          window.location.replace(`/terminal/${clean.size ? `?${clean}` : ''}#${proDestination}`);
        };
        redirectLegacyHash();
        window.addEventListener('hashchange', redirectLegacyHash);
        return () => window.removeEventListener('hashchange', redirectLegacyHash);
      }, [technical, pro]);

      useEffect(() => {
        let cancelled = false;
        let frame = 0;
        let settleTimer = 0;
        let resizeObserver = null;
        let mutationObserver = null;
        let layoutObserver = null;
        let stopObserving = 0;
        let realignTimers = [];
        const currentHashId = () => {
          try {
            return decodeURIComponent(window.location.hash.slice(1));
          } catch {
            return '';
          }
        };
        const alignHashTarget = () => {
          if (cancelled) return;
          const id = currentHashId();
          if (!id) return;
          document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' });
        };
        const queueRealignments = () => {
          realignTimers.forEach((timer) => window.clearTimeout(timer));
          alignHashTarget();
          realignTimers = [250, 1000, 2500, 4500, 7000, 10000].map((delay) => (
            window.setTimeout(alignHashTarget, delay)
          ));
        };
        const scheduleAlignment = () => {
          window.clearTimeout(settleTimer);
          settleTimer = window.setTimeout(alignHashTarget, 120);
        };
        const afterLayout = () => {
          frame = window.requestAnimationFrame(() => {
            frame = window.requestAnimationFrame(alignHashTarget);
          });
        };
        const stopObservers = () => {
          resizeObserver?.disconnect();
          mutationObserver?.disconnect();
          layoutObserver?.disconnect();
        };
        const stopAlignmentOnInput = (event) => {
          if (!event.isTrusted) return;
          window.clearTimeout(settleTimer);
          realignTimers.forEach((timer) => window.clearTimeout(timer));
          realignTimers = [];
          stopObservers();
        };

        if (document.fonts?.ready) {
          document.fonts.ready.then(afterLayout);
        } else {
          afterLayout();
        }
        window.addEventListener('load', alignHashTarget, { once: true });

        const shell = document.querySelector('.zd');
        if (shell && 'ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(scheduleAlignment);
          resizeObserver.observe(document.querySelector('.cine') ?? shell);
          const gallery = document.querySelector('.gband');
          if (gallery) resizeObserver.observe(gallery);
          const initialId = currentHashId();
          for (const child of shell.children) {
            resizeObserver.observe(child);
            if (initialId && child.id === initialId) break;
          }
        }
        if (shell && 'MutationObserver' in window) {
          mutationObserver = new MutationObserver(scheduleAlignment);
          mutationObserver.observe(shell, {
            childList: true,
            characterData: true,
            subtree: true,
          });
        }
        if ('PerformanceObserver' in window
          && PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
          layoutObserver = new PerformanceObserver((list) => {
            if (list.getEntries().some((entry) => !entry.hadRecentInput)) scheduleAlignment();
          });
          layoutObserver.observe({ type: 'layout-shift', buffered: true });
        }
        queueRealignments();
        window.addEventListener('hashchange', queueRealignments);
        window.addEventListener('wheel', stopAlignmentOnInput, { passive: true });
        window.addEventListener('touchstart', stopAlignmentOnInput, { passive: true });
        window.addEventListener('pointerdown', stopAlignmentOnInput, { passive: true });
        window.addEventListener('keydown', stopAlignmentOnInput);
        stopObserving = window.setTimeout(stopObservers, 12000);

        return () => {
          cancelled = true;
          window.cancelAnimationFrame(frame);
          window.clearTimeout(settleTimer);
          window.clearTimeout(stopObserving);
          realignTimers.forEach((timer) => window.clearTimeout(timer));
          stopObservers();
          window.removeEventListener('load', alignHashTarget);
          window.removeEventListener('hashchange', queueRealignments);
          window.removeEventListener('wheel', stopAlignmentOnInput);
          window.removeEventListener('touchstart', stopAlignmentOnInput);
          window.removeEventListener('pointerdown', stopAlignmentOnInput);
          window.removeEventListener('keydown', stopAlignmentOnInput);
        };
      }, []);

      if (technical) {
        return (
          <>
            <a href="#main" className="skip">Skip to content</a>
            <div className="stars" aria-hidden="true" />
            <div className="grain" aria-hidden="true" />
            <Header />
            <main id="main" className="zd technical-registry">
              <header className="technical-hero">
                <a className="technical-hero__back" href="/registry/">← Zodiacs Registry</a>
                <span className="technical-hero__kicker">The complete public record</span>
                <h1>Registry <span className="it">technical record.</span></h1>
                <p>
                  Addresses, networks, market methodology, third-party access,
                  builder tools, and disclosures for the twelve Zodiacs.
                </p>
                <dl className="technical-hero__facts">
                  <div><dt>12</dt><dd>signs</dd></div>
                  <div><dt>24</dt><dd>official addresses</dd></div>
                  <div><dt>2</dt><dd>networks</dd></div>
                </dl>
              </header>

              <nav className="technical-nav" aria-label="Technical record sections">
                <a href="#records-networks"><span>01</span>Records and networks</a>
                <a href="#market-transparency"><span>02</span>Market and transparency</a>
                <a href="#access-third-parties"><span>03</span>Access and third parties</a>
                <a href="#builder-tools"><span>04</span>Builders</a>
                <a href="#safety-evidence"><span>05</span>Safety and evidence</a>
              </nav>

              <TechnicalRecordsSection />

              <section id="market-transparency" className="technical-group" aria-labelledby="technical-market-title">
                <header className="technical-group__head">
                  <span>02</span>
                  <div><h2 id="technical-market-title">Market and transparency</h2><p>Live attention, market context, sources, and methodology.</p></div>
                </header>
                <PulseSection />
                <StandingsSection />
              </section>

              <section id="access-third-parties" className="technical-group" aria-labelledby="technical-access-title">
                <header className="technical-group__head">
                  <span>03</span>
                  <div><h2 id="technical-access-title">Access and third parties</h2><p>Independent interfaces and point-of-action warnings.</p></div>
                </header>
                <OnchainAccessSection />
              </section>

              <section id="builder-tools" className="technical-group" aria-labelledby="technical-builders-title">
                <span id="builders" className="technical-group__legacy-anchor" aria-hidden="true" />
                <header className="technical-group__head">
                  <span>04</span>
                  <div><h2 id="technical-builders-title">Builders</h2><p>SDK capabilities, examples, APIs, and product uses.</p></div>
                </header>
                <ForBuildersSection />
                <BuiltWithZodiacsSection />
                <IdentityContextSection />
                <SdkSection />
              </section>

              <section id="safety-evidence" className="technical-group" aria-labelledby="technical-safety-title">
                <header className="technical-group__head">
                  <span>05</span>
                  <div><h2 id="technical-safety-title">Safety and evidence</h2><p>Read-only posture, provenance, disclosures, archive, and full questions.</p></div>
                </header>
                <SecuritySection />
                <TechnicalEvidenceLinks />
                <FaqSection />
              </section>

            </main>
            <TechnicalFooter />
          </>
        );
      }

      if (pro) {
        return (
          <>
            <a href="#main" className="skip">Skip to content</a>
            <div className="stars" aria-hidden="true" />
            <div className="grain" aria-hidden="true" />
            <Header />
            <main id="main" className="zd terminal-pro">
              <ProMasthead batch={proMarket} />
              <ProSelectedSign sign={sign} batch={proMarket} />
              <ProMarketBoard active={activeTicker} setActive={setActiveTicker} batch={proMarket} />
              <ProMarketsGateway sign={sign} />
              <ConsumerMarketBriefing active={activeTicker} sharedMarket={proMarket} />
              <ProResearchSection sign={sign} />
              <ProVerifierLink sign={sign} />
              <MarketVenueNotice />
            </main>
            <SiteEnd tagline="Live market context, anchored to verified public records." />
          </>
        );
      }

      return (
        <>
          <a href="#main" className="skip">Skip to content</a>
          <div className="stars" aria-hidden="true" />
          <div className="grain" aria-hidden="true" />
          <Header />
          <main id="main" className="zd consumer-registry consumer-campaign">
            <div className="campaign-stack">
              <CampaignHero />
              <CampaignBag sign={sign} batch={consumerMarket} onPick={pickFromBag} />
              <CampaignRunway
                anchorTicker={anchorTicker}
                active={activeTicker}
                setActive={setActiveTicker}
                batch={consumerMarket}
              />
            </div>
            <CampaignAbout />
            <CampaignApp />
            <ConsumerStory />
            <ConsumerShop />
            <ConsumerCabinet />
            <ConsumerRegistryGuide sign={sign} />
            <ConsumerMarketGateway batch={consumerMarket} activeTicker={activeTicker} />
            <ConsumerFaq />
            <span id="market" className="terminal-compat-target" aria-hidden="true" />
            <span id="briefing" className="terminal-compat-target" aria-hidden="true" />
            <span id="research" className="terminal-compat-target" aria-hidden="true" />
            <span id="outlook" className="terminal-compat-target" aria-hidden="true" />
            <MarketVenueNotice />
          </main>
          <SiteEnd tagline="The official public Registry of the Twelve." />
        </>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<Zodiacs />);
