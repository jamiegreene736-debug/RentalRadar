from __future__ import annotations

import random
from dataclasses import dataclass, field

from playwright.async_api import BrowserContext, Page


@dataclass(frozen=True)
class FingerprintProfile:
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
    )
    locale: str = "en-US"
    timezone_id: str = "America/New_York"
    viewport: dict[str, int] = field(default_factory=lambda: {"width": 1920, "height": 1080})
    hardware_concurrency: int = 8
    device_memory: int = 8
    languages: tuple[str, ...] = ("en-US", "en")
    webgl_vendor: str = "Intel Inc."
    webgl_renderer: str = "Intel Iris OpenGL Engine"


USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
]


def random_fingerprint() -> FingerprintProfile:
    return FingerprintProfile(
        user_agent=random.choice(USER_AGENTS),
        viewport=random.choice(
            [
                {"width": 1920, "height": 1080},
                {"width": 1680, "height": 1050},
                {"width": 1440, "height": 900},
                {"width": 1536, "height": 864},
            ]
        ),
        hardware_concurrency=random.choice([4, 6, 8, 10, 12]),
        device_memory=random.choice([4, 8, 16]),
        webgl_vendor=random.choice(["Intel Inc.", "NVIDIA Corporation", "ATI Technologies Inc."]),
        webgl_renderer=random.choice(
            [
                "Intel Iris OpenGL Engine",
                "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)",
                "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)",
            ]
        ),
    )


async def apply_stealth_patches(context: BrowserContext, profile: FingerprintProfile) -> None:
    """Manual 2026 stealth patch set for headed Chrome.

    This avoids stale third-party stealth packages and keeps each patch explicit.
    """

    await context.add_init_script(
        """
        ({ hardwareConcurrency, deviceMemory, languages, webglVendor, webglRenderer }) => {
          const defineGetter = (obj, prop, value) => {
            try {
              Object.defineProperty(obj, prop, { get: () => value, configurable: true });
            } catch (_) {}
          };

          // 1. navigator.webdriver = undefined
          defineGetter(Navigator.prototype, 'webdriver', undefined);

          // 3. Realistic font enumeration surface for CSS/font probes.
          const fontFamilies = [
            'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Courier New', 'Georgia',
            'Helvetica', 'Times New Roman', 'Trebuchet MS', 'Verdana',
            'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'
          ];
          if (document.fonts && document.fonts.check) {
            const originalCheck = document.fonts.check.bind(document.fonts);
            document.fonts.check = (font, text) => {
              if (fontFamilies.some((name) => font.includes(name))) return true;
              return originalCheck(font, text);
            };
          }

          // 4. Canvas noise.
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function(...args) {
            const ctx = this.getContext('2d');
            if (ctx) {
              const w = Math.min(this.width, 64);
              const h = Math.min(this.height, 64);
              try {
                const imageData = ctx.getImageData(0, 0, w, h);
                for (let i = 0; i < imageData.data.length; i += 37) {
                  imageData.data[i] = imageData.data[i] ^ 1;
                }
                ctx.putImageData(imageData, 0, 0);
              } catch (_) {}
            }
            return originalToDataURL.apply(this, args);
          };

          // 2 and 4. WebGL fingerprint randomization plus light parameter noise.
          const patchWebGL = (proto) => {
            if (!proto) return;
            const originalGetParameter = proto.getParameter;
            proto.getParameter = function(parameter) {
              if (parameter === 37445) return webglVendor;
              if (parameter === 37446) return webglRenderer;
              if (parameter === 3379) return 16384;
              return originalGetParameter.call(this, parameter);
            };
          };
          patchWebGL(WebGLRenderingContext.prototype);
          if (window.WebGL2RenderingContext) patchWebGL(WebGL2RenderingContext.prototype);

          // 5. Chrome-specific APIs, plugins, languages.
          window.chrome = window.chrome || {};
          window.chrome.runtime = window.chrome.runtime || {};
          window.chrome.app = window.chrome.app || { isInstalled: false };
          defineGetter(navigator, 'webdriver', undefined);

          defineGetter(Navigator.prototype, 'plugins', [
            { 0: {}, name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', length: 1 },
            { 0: {}, name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', length: 1 },
            { 0: {}, name: 'Native Client', filename: 'internal-nacl-plugin', length: 1 },
            { 0: {}, name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', length: 1 },
            { 0: {}, name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', length: 1 }
          ]);
          defineGetter(Navigator.prototype, 'languages', languages);
          defineGetter(Navigator.prototype, 'language', languages[0]);

          // 6. Hardware concurrency and device memory spoofing.
          defineGetter(Navigator.prototype, 'hardwareConcurrency', hardwareConcurrency);
          defineGetter(Navigator.prototype, 'deviceMemory', deviceMemory);

          // Permission query shape aligns with Chrome.
          const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
          if (originalQuery) {
            window.navigator.permissions.query = (parameters) => (
              parameters && parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters)
            );
          }
        }
        """,
        {
            "hardwareConcurrency": profile.hardware_concurrency,
            "deviceMemory": profile.device_memory,
            "languages": list(profile.languages),
            "webglVendor": profile.webgl_vendor,
            "webglRenderer": profile.webgl_renderer,
        },
    )


async def humanize_page(page: Page) -> None:
    # 7. Human-like mouse movement, scrolling, and typing delays support.
    await page.mouse.move(random.randint(100, 800), random.randint(100, 600), steps=50)
    await page.wait_for_timeout(random.randint(300, 1200))


async def human_scroll(page: Page, min_scrolls: int = 2, max_scrolls: int = 6) -> None:
    for _ in range(random.randint(min_scrolls, max_scrolls)):
        await page.mouse.wheel(0, random.randint(180, 740))
        await page.wait_for_timeout(random.randint(450, 1600))


async def human_type(page: Page, selector: str, text: str) -> None:
    await page.click(selector, delay=random.randint(60, 180))
    for char in text:
        await page.keyboard.type(char, delay=random.randint(65, 190))
        if random.random() < 0.08:
            await page.wait_for_timeout(random.randint(180, 420))
