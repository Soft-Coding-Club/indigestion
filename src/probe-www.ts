import { chromium } from "playwright";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });
  const page = await ctx.newPage();

  console.log("→ www.reddit.com/r/AmItheAsshole (logged out)");
  await page.goto("https://www.reddit.com/r/AmItheAsshole/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await sleep(4000);
  await page.screenshot({ path: "out/probe-www-feed.png" });

  const postCount = await page.locator("shreddit-post").count();
  console.log(`shreddit-post elements: ${postCount}`);
  if (postCount > 0) {
    const titles = await page
      .locator("shreddit-post")
      .evaluateAll((els) =>
        els.slice(0, 5).map((e) => e.getAttribute("post-title") ?? "(no title attr)"),
      );
    console.log("titles:", JSON.stringify(titles, null, 1));
  }

  console.log("→ in-browser fetch of hot.json");
  const jsonProbe = await page.evaluate(async () => {
    try {
      const r = await fetch("/r/AmItheAsshole/hot.json?limit=3", {
        headers: { accept: "application/json" },
      });
      const body = await r.text();
      return { status: r.status, head: body.slice(0, 200) };
    } catch (e) {
      return { status: -1, head: String(e) };
    }
  });
  console.log(`json status: ${jsonProbe.status}`);
  console.log(`json head: ${jsonProbe.head}`);

  const first = page.locator("shreddit-post").first();
  if ((await first.count()) > 0) {
    const permalink = await first.getAttribute("permalink");
    if (permalink) {
      console.log(`→ 스레드 진입: ${permalink}`);
      await page.goto(`https://www.reddit.com${permalink}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await sleep(4000);
      await page.screenshot({ path: "out/probe-www-thread.png" });
      const commentCount = await page.locator("shreddit-comment").count();
      console.log(`shreddit-comment elements: ${commentCount}`);
      if (commentCount > 0) {
        const sample = await page
          .locator("shreddit-comment p")
          .evaluateAll((els) =>
            els.slice(0, 4).map((e) => (e.textContent ?? "").trim().slice(0, 90)),
          );
        console.log("comment samples:", JSON.stringify(sample, null, 1));
      }
    }
  }

  await browser.close();
  console.log("probe 종료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
