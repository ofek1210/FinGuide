import { useEffect, type RefObject } from "react";

/**
 * Hero orchestration + scroll reveals + stat count-up + FAQ accordion.
 * Ported from the Claude Design landing `hero-anim.js`, scoped to the
 * landing root element and with full teardown (timers / observers /
 * listeners) so nothing survives a route change.
 */
export function useLandingAnimations(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Tracked for teardown
    const timeouts: number[] = [];
    const intervals: number[] = [];
    const observers: IntersectionObserver[] = [];
    const cleanups: Array<() => void> = [];
    const after = (fn: () => void, ms: number) => {
      timeouts.push(window.setTimeout(fn, ms));
    };

    /* ---- hero copy entrance ---- */
    root.querySelectorAll<HTMLElement>(".copy [data-rise], .copy h1").forEach((el, i) => {
      after(() => el.classList.add("lit"), 120 + i * 110);
    });

    /* ============ HERO ORCHESTRATION ANIMATION ============ */
    const stage = root.querySelector<HTMLElement>(".stage");
    if (stage) {
      const cards = ["pc-scan", "pc-fees", "pc-match", "pc-fetch", "pc-route"].map((c) =>
        stage.querySelector<HTMLElement>("." + c)
      );
      const result = stage.querySelector<HTMLElement>(".result");
      const feeBar = stage.querySelector<HTMLElement>(".pc-match .pbar i");

      const offsets: [number, number, number][] = [
        [-280, -160, -16], // scan  (from top-left)
        [-300, 120, 14], // fees  (from bottom-left)
        [300, -150, 16], // match (from top-right)
        [320, 120, -14], // fetch (from bottom-right)
        [0, 240, 0], // route (from bottom)
      ];
      cards.forEach((card, i) => {
        if (!card) return;
        const o = offsets[i];
        const base = card.classList.contains("pc-route") ? "translateX(-50%) " : "";
        card.style.transform = base + "translate(" + o[0] + "px," + o[1] + "px) rotate(" + o[2] + "deg)";
      });

      const activate = (i: number) => {
        if (cards[i]) cards[i]!.classList.add("active");
      };
      const done = (i: number) => {
        if (cards[i]) {
          cards[i]!.classList.remove("active");
          cards[i]!.classList.add("done");
        }
      };

      const flyDot = (card: HTMLElement) => {
        if (reduce) return;
        const sr = stage.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        const sx = cr.left + cr.width / 2 - sr.left;
        const sy = cr.top + cr.height / 2 - sr.top;
        const ex = sr.width / 2;
        const ey = sr.height / 2;
        const dot = document.createElement("div");
        dot.className = "spark-dot";
        dot.style.left = sx + "px";
        dot.style.top = sy + "px";
        dot.style.transition = "transform .7s cubic-bezier(.4,0,.2,1), opacity .7s ease";
        stage.appendChild(dot);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            dot.style.transform = "translate(" + (ex - sx) + "px," + (ey - sy) + "px) scale(.4)";
            dot.style.opacity = "0";
          });
        });
        after(() => dot.remove(), 760);
      };

      const countUp = () => {
        if (!result) return;
        const el = result.querySelector<HTMLElement>(".v b") || result.querySelector<HTMLElement>(".v");
        if (!el) return;
        const target = 12400;
        let start: number | null = null;
        const dur = 900;
        if (reduce) {
          el.textContent = "12,400";
          return;
        }
        const tick = (ts: number) => {
          if (!start) start = ts;
          const p = Math.min((ts - start) / dur, 1);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * e).toLocaleString("en-US");
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };

      const cycle = () => {
        cards.forEach((c) => c && c.classList.remove("active"));
        stage.classList.remove("scanning");
        result && result.classList.remove("show");
        if (feeBar) feeBar.style.width = "40%";

        const seq: Array<() => void> = [
          () => {
            stage.classList.add("scanning");
            activate(0);
          },
          () => {
            done(0);
            activate(1);
            cards[1] && flyDot(cards[1]!);
          },
          () => {
            done(1);
            activate(2);
            if (feeBar) feeBar.style.width = "88%";
            cards[2] && flyDot(cards[2]!);
          },
          () => {
            done(2);
            activate(3);
            cards[3] && flyDot(cards[3]!);
          },
          () => {
            done(3);
            activate(4);
            cards[4] && flyDot(cards[4]!);
          },
          () => {
            done(4);
            stage.classList.remove("scanning");
            result && result.classList.add("show");
            countUp();
          },
        ];
        seq.forEach((fn, i) => after(fn, 520 * i));
      };

      const startLoop = () => {
        if (reduce) {
          cards.forEach((c) => c && c.classList.add("done"));
          result && result.classList.add("show");
          countUp();
          return;
        }
        cycle();
        intervals.push(
          window.setInterval(() => {
            cards.forEach((c) => c && c.classList.remove("done"));
            cycle();
          }, 520 * 6 + 1600)
        );
      };

      const settle = () => {
        stage.classList.add("entered");
        cards.forEach((card, i) => {
          if (!card) return;
          after(() => {
            card.style.transform = card.classList.contains("pc-route") ? "translateX(-50%)" : "none";
          }, 120 + i * 120);
        });
        after(startLoop, 1500);
      };

      let started = false;
      const maybeStart = () => {
        if (started) return;
        const r = stage.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9) {
          started = true;
          after(settle, 280);
        }
      };
      maybeStart();
      window.addEventListener("scroll", maybeStart, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", maybeStart));

      /* pointer parallax (layered depth) */
      if (window.matchMedia("(pointer:fine)").matches && !reduce) {
        const pl = [
          { el: stage.querySelector<HTMLElement>(".doc"), d: 0.5, base: "translate(-50%,-50%)" },
          { el: cards[0], d: 1.6 },
          { el: cards[1], d: 2.0 },
          { el: cards[2], d: 1.4 },
          { el: cards[3], d: 1.1 },
        ];
        let tx = 0,
          ty = 0,
          cx = 0,
          cy = 0,
          raf: number | null = null;
        const ploop = () => {
          cx += (tx - cx) * 0.07;
          cy += (ty - cy) * 0.07;
          pl.forEach((o) => {
            if (!o.el) return;
            const settledNow =
              o.el.style.transform === "none" || o.el.style.transform.indexOf("rotate") === -1;
            if (!settledNow && o.el !== pl[0].el) return;
            const base = o.base
              ? o.base + " "
              : o.el.classList.contains("pc-route")
                ? "translateX(-50%) "
                : "";
            o.el.style.transform = base + "translate(" + cx * o.d * 12 + "px," + cy * o.d * 12 + "px)";
          });
          if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
            raf = requestAnimationFrame(ploop);
          } else {
            raf = null;
          }
        };
        const onMove = (e: MouseEvent) => {
          const r = stage.getBoundingClientRect();
          tx = (e.clientX - (r.left + r.width / 2)) / r.width;
          ty = (e.clientY - (r.top + r.height / 2)) / r.height;
          if (!raf) raf = requestAnimationFrame(ploop);
        };
        const onLeave = () => {
          tx = 0;
          ty = 0;
          if (!raf) raf = requestAnimationFrame(ploop);
        };
        stage.addEventListener("mousemove", onMove);
        stage.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          stage.removeEventListener("mousemove", onMove);
          stage.removeEventListener("mouseleave", onLeave);
          if (raf) cancelAnimationFrame(raf);
        });
      }
    }

    /* ============ scroll reveals ============ */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.16 }
    );
    root.querySelectorAll(".rv").forEach((el) => io.observe(el));
    observers.push(io);

    /* ============ stat count-up ============ */
    const statObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          const target = parseFloat(el.dataset.to || "0");
          const suf = el.dataset.suffix || "";
          const pre = el.dataset.prefix || "";
          const dec = el.dataset.dec ? parseInt(el.dataset.dec, 10) : 0;
          let start: number | null = null;
          const dur = 1300;
          if (reduce) {
            el.textContent = pre + target.toLocaleString("en-US") + suf;
            statObserver.unobserve(el);
            return;
          }
          const tick = (ts: number) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            const e = 1 - Math.pow(1 - p, 3);
            const val = target * e;
            el.textContent = pre + (dec ? val.toFixed(dec) : Math.round(val).toLocaleString("en-US")) + suf;
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          statObserver.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );
    root.querySelectorAll("[data-to]").forEach((el) => statObserver.observe(el));
    observers.push(statObserver);

    /* ============ AI CHAT DEMO ============ */
    const cdSection = root.querySelector<HTMLElement>(".chat-demo");
    if (cdSection) {
      const featEls = Array.from(cdSection.querySelectorAll<HTMLElement>("[data-cd-feat]"));
      const messagesEl = cdSection.querySelector<HTMLElement>("#cdMessages");

      const convs = [
        {
          feat: 0,
          user: "שלחתי את התלוש שלי. מה גיליתם?",
          ai: "זיהינו 3 ממצאים: דמי ניהול 1.9% — גבוה מהממוצע ב-1.4%, ניכוי מס לא מנוצל, וחסרה הפרשה לקרן השתלמות. חיסכון אפשרי: ₪4,830 לשנה",
        },
        {
          feat: 1,
          user: "מה מצב הפנסיה שלי?",
          ai: "ניתחתי את קרן הפנסיה. מסלול הסיכון לא מתאים לגיל שלך — ממליץ לעבור למסלול צמיחה. תוספת צבירה: ₪312,000 עד גיל 67",
        },
        {
          feat: 2,
          user: "האם מגיע לי החזר מס?",
          ai: "כן! זוהתה יתרת זיכוי לא ממומשת: ₪4,210 — נקודות זיכוי ותרומות. אגיש עבורך בקשה לפקיד שומה",
        },
        {
          feat: 3,
          user: "כמה כסף אחסוך עד הפרישה?",
          ai: "לפי הנתונים הנוכחיים: ₪3,654,000 בגיל 67. אם תשנה מסלול ותוריד דמי ניהול — תגיע ל-₪4,698,000. הפרש של מעל מיליון ₪",
        },
      ];

      const CD_DUR = 5200;
      let cdIdx = 0;

      const clearChat = () => {
        if (messagesEl) messagesEl.innerHTML = "";
      };

      const addUserMsg = (text: string) => {
        if (!messagesEl) return;
        const el = document.createElement("div");
        el.className = "cd-msg user";
        el.textContent = text;
        messagesEl.appendChild(el);
        after(() => el.classList.add("in"), 30);
      };

      const addTyping = (): HTMLElement | null => {
        if (!messagesEl) return null;
        const el = document.createElement("div");
        el.className = "cd-typing";
        el.innerHTML = "<span></span><span></span><span></span>";
        messagesEl.appendChild(el);
        after(() => el.classList.add("in"), 30);
        return el;
      };

      const addAiMsg = (text: string, typingEl: HTMLElement | null) => {
        after(() => {
          if (typingEl) typingEl.remove();
          if (!messagesEl) return;
          const el = document.createElement("div");
          el.className = "cd-msg ai";
          el.textContent = text;
          messagesEl.appendChild(el);
          after(() => el.classList.add("in"), 30);
        }, 0);
      };

      const runConv = (idx: number) => {
        const conv = convs[idx];
        featEls.forEach((el, i) => el.classList.toggle("active", i === conv.feat));
        clearChat();
        after(() => {
          addUserMsg(conv.user);
          after(() => {
            const typing = addTyping();
            after(() => addAiMsg(conv.ai, typing), 1100);
          }, 600);
        }, 180);
      };

      if (reduce) {
        const last = convs[convs.length - 1];
        featEls.forEach((el, i) => el.classList.toggle("active", i === last.feat));
        if (messagesEl) {
          const u = document.createElement("div");
          u.className = "cd-msg user in";
          u.textContent = last.user;
          const a = document.createElement("div");
          a.className = "cd-msg ai in";
          a.textContent = last.ai;
          messagesEl.appendChild(u);
          messagesEl.appendChild(a);
        }
      } else {
        let cdStarted = false;
        const startCd = () => {
          if (cdStarted) return;
          cdStarted = true;
          runConv(0);
          intervals.push(
            window.setInterval(() => {
              cdIdx = (cdIdx + 1) % convs.length;
              runConv(cdIdx);
            }, CD_DUR)
          );
        };

        const cdObs = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              startCd();
              cdObs.disconnect();
            }
          },
          { threshold: 0.25 }
        );
        cdObs.observe(cdSection);
        observers.push(cdObs);
      }
    }

    /* ============ FAQ accordion ============ */
    const faqButtons = Array.from(root.querySelectorAll<HTMLButtonElement>(".qa button"));
    const onFaqClick = (btn: HTMLButtonElement) => () => {
      const qa = btn.parentElement!;
      const ans = qa.querySelector<HTMLElement>(".ans")!;
      const open = qa.classList.contains("open");
      root.querySelectorAll<HTMLElement>(".qa.open").forEach((o) => {
        o.classList.remove("open");
        const a = o.querySelector<HTMLElement>(".ans");
        if (a) a.style.maxHeight = "";
      });
      if (!open) {
        qa.classList.add("open");
        ans.style.maxHeight = ans.scrollHeight + "px";
      }
    };
    const faqHandlers = faqButtons.map((btn) => {
      const h = onFaqClick(btn);
      btn.addEventListener("click", h);
      return [btn, h] as const;
    });
    cleanups.push(() => faqHandlers.forEach(([btn, h]) => btn.removeEventListener("click", h)));

    /* nav shadow on scroll */
    const navInner = root.querySelector<HTMLElement>(".nav-inner");
    const onScroll = () => {
      if (!navInner) return;
      navInner.style.boxShadow =
        window.scrollY > 20
          ? "0 16px 40px -22px rgba(70,40,130,.5)"
          : "0 12px 34px -20px rgba(70,40,130,.4)";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    /* ============ teardown ============ */
    return () => {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      observers.forEach((o) => o.disconnect());
      cleanups.forEach((fn) => fn());
      root.querySelectorAll(".spark-dot").forEach((d) => d.remove());
    };
  }, [rootRef]);
}
