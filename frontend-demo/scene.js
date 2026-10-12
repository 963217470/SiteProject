(function () {
  "use strict";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(pointer: fine) and (min-width: 801px)");
  const canvas = document.getElementById("world");
  const hero = document.getElementById("hero");
  const ctx = canvas.getContext("2d");
  let width = 900,
    height = 390,
    frame = 0,
    visible = true,
    pointer = { x: 0, y: 0 },
    offset = { x: 0, y: 0 };
  function rect(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function mountain(c, x, y, size, color) {
    for (let i = 0; i < size; i += 12)
      rect(c, x - i, y + i, i * 2 + 24, 13, color);
  }
  function tree(c, x, y, s = 1, color = "#366653") {
    rect(c, x - 3 * s, y, 6 * s, 21 * s, "#7d7860");
    rect(c, x - 12 * s, y - 15 * s, 24 * s, 23 * s, color);
    rect(c, x - 19 * s, y - 2 * s, 38 * s, 15 * s, color);
    rect(c, x - 6 * s, y - 25 * s, 12 * s, 15 * s, color);
    rect(c, x - 10 * s, y - 8 * s, 5 * s, 8 * s, "#729567");
  }
  function cloud(c, x, y) {
    rect(c, x, y, 58, 10, "#f8fff4");
    rect(c, x + 10, y - 9, 25, 12, "#f8fff4");
    rect(c, x + 30, y - 5, 18, 8, "#f8fff4");
  }
  function draw(time = 0) {
    const t = motion.matches ? 0 : time / 1000;
    offset.x += (pointer.x - offset.x) * 0.04;
    offset.y += (pointer.y - offset.y) * 0.04;
    const mobile = width < 560;
    const center = mobile ? width * 0.58 : width * 0.76;
    const base = mobile ? height * 0.86 : height * 0.59;
    ctx.clearRect(0, 0, width, height);
    rect(ctx, 0, 0, width, height, "#d9eee4");
    rect(ctx, 0, height * 0.43, width, height, "#aad2bb");
    rect(ctx, center + 70, base - 115, 32, 32, "#fff0af");
    const drift = Math.sin(t * 0.1) * 14;
    cloud(ctx, center - 210 + drift + offset.x * 0.5, base - 115);
    cloud(ctx, center + 30 + drift * 0.7 + offset.x * 0.5, base - 160);
    cloud(ctx, center + 155 - drift * 0.3 + offset.x * 0.5, base - 78);
    mountain(ctx, center - 150 + offset.x, base - 75, 105, "#9ebfa9");
    mountain(ctx, center + 80 + offset.x, base - 90, 140, "#b5cbb4");
    mountain(ctx, center - 10 + offset.x * 1.5, base - 25, 90, "#87ab95");
    rect(ctx, 0, base + 36, width, height, "#a6d9ce");
    for (let i = 0; i < 22; i++) {
      const x = (i * 109 + Math.sin(t * 0.5 + i) * 8) % width;
      rect(
        ctx,
        x,
        base + 45 + ((i * 23) % (height - base - 48)),
        15 + (i % 5) * 6,
        2,
        i % 2 ? "#c7e7d8" : "#8ec8bc",
      );
    }
    ctx.save();
    ctx.translate(Math.round(offset.x * 2), Math.round(offset.y));
    rect(ctx, center - 137, base + 15, 262, 43, "#699383");
    rect(ctx, center - 114, base + 56, 217, 13, "#557b70");
    rect(ctx, center - 153, base + 5, 288, 17, "#a2be7f");
    rect(ctx, center - 139, base - 5, 265, 18, "#c4d99a");
    rect(ctx, center - 104, base - 16, 173, 20, "#c4d99a");
    tree(ctx, center - 94, base - 27, 1.3);
    tree(ctx, center + 70, base - 29, 1.4);
    tree(ctx, center + 105, base - 16, 0.8);
    rect(ctx, center - 34, base - 62, 67, 60, "#f3e5b6");
    rect(ctx, center - 37, base - 62, 73, 7, "#a85549");
    rect(ctx, center - 42, base - 70, 82, 9, "#d85d4d");
    rect(ctx, center - 33, base - 79, 64, 9, "#e77358");
    rect(ctx, center - 24, base - 88, 46, 9, "#e77358");
    rect(ctx, center - 15, base - 96, 28, 8, "#f48868");
    rect(ctx, center + 18, base - 102, 9, 25, "#766d59");
    rect(ctx, center - 6, base - 24, 16, 22, "#8a7e65");
    rect(ctx, center - 23, base - 47, 12, 12, "#94c5b2");
    rect(ctx, center + 14, base - 47, 12, 12, "#94c5b2");
    // The eye closes briefly once every six seconds, without moving the body.
    const px = center - 50,
      py = base + 4;
    rect(ctx, px, py - 22, 14, 9, "#3d4d49");
    rect(ctx, px + 2, py - 16, 11, 7, "#f4d6a3");
    rect(ctx, px + 9, py - 14, 2, t % 6 > 5.8 ? 1 : 2, "#384c42");
    rect(ctx, px + 1, py - 9, 12, 13, "#dc5949");
    rect(ctx, px - 2, py - 7, 4, 8, "#f4d6a3");
    rect(ctx, px + 12, py - 7, 4, 8, "#f4d6a3");
    rect(ctx, px + 1, py + 4, 4, 6, "#3d4d49");
    rect(ctx, px + 9, py + 4, 4, 6, "#3d4d49");
    for (let i = 0; i < 9; i++)
      rect(
        ctx,
        center - 110 + i * 25,
        base + (i % 2 ? 6 : -2),
        3,
        3,
        "#f7efbc",
      );
    ctx.restore();
    tree(ctx, width - 20, height - 18, 2, "#648c70");
    tree(ctx, width - 50, height - 10, 1.6, "#7ea07b");
    if (mobile) tree(ctx, 18, height - 15, 1.6, "#719976");
  }
  function tick(t) {
    frame = 0;
    draw(t);
    if (visible && !document.hidden && !motion.matches)
      frame = requestAnimationFrame(tick);
  }
  function start() {
    cancelAnimationFrame(frame);
    frame = 0;
    draw(performance.now());
    if (visible && !document.hidden && !motion.matches)
      frame = requestAnimationFrame(tick);
  }
  function resize() {
    width = Math.round(hero.clientWidth / 2);
    height = Math.round(hero.clientHeight / 2);
    canvas.width = width;
    canvas.height = height;
    start();
  }
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    start();
  }).observe(hero);
  hero.addEventListener("pointermove", (e) => {
    if (!fine.matches || motion.matches) return;
    const b = hero.getBoundingClientRect();
    pointer = {
      x: ((e.clientX - b.left) / b.width) * 5 - 2.5,
      y: ((e.clientY - b.top) / b.height) * 3 - 1.5,
    };
  });
  hero.addEventListener("pointerleave", () => {
    pointer = { x: 0, y: 0 };
  });
  document.addEventListener("visibilitychange", start);
  motion.addEventListener("change", start);
  fine.addEventListener("change", () => {
    pointer = { x: 0, y: 0 };
    start();
  });
  window.RDArt = function (target, theme) {
    const c = target.getContext("2d");
    target.width = 480;
    target.height = 270;
    rect(
      c,
      0,
      0,
      480,
      270,
      theme === "moon" ? "#6c3448" : theme === "forest" ? "#8aaa82" : "#676387",
    );
    if (theme === "moon") {
      rect(c, 343, 30, 56, 56, "#f39576");
      rect(c, 333, 42, 76, 32, "#f39576");
      mountain(c, 100, 75, 180, "#99536a");
      mountain(c, 285, 95, 170, "#824459");
      mountain(c, 450, 115, 140, "#542e41");
      rect(c, 0, 224, 480, 46, "#402b38");
      rect(c, 315, 206, 92, 9, "#e1a48d");
      rect(c, 320, 215, 82, 40, "#593648");
      rect(c, 355, 178, 11, 11, "#efd7b2");
      rect(c, 353, 189, 15, 17, "#cd624f");
    } else if (theme === "forest") {
      rect(c, 175, 0, 55, 270, "#bdd7a1");
      rect(c, 190, 0, 16, 270, "#d7e7b7");
      for (let i = 0; i < 13; i++)
        tree(
          c,
          i * 43 - 14,
          40 + (i % 4) * 37,
          2,
          i % 2 ? "#577e59" : "#6d905f",
        );
      rect(c, 0, 232, 480, 38, "#496d50");
      rect(c, 210, 187, 15, 10, "#f9f1c4");
      rect(c, 214, 197, 7, 12, "#f9f1c4");
      for (let i = 0; i < 14; i++)
        rect(c, (i * 71) % 480, (i * 37) % 230, 3, 3, "#e5eec1");
    } else {
      for (let i = 0; i < 50; i++)
        rect(c, (i * 73) % 480, (i * 41) % 270, i % 3 ? 2 : 3, 2, "#c9c2e4");
      rect(c, 350, 33, 45, 45, "#b9acdb");
      rect(c, 338, 46, 68, 20, "#b9acdb");
      rect(c, 326, 67, 93, 5, "#e4bfdd");
      for (let i = 0; i < 3; i++) {
        const x = 90 + i * 130,
          y = 185 - i * 35;
        rect(c, x, y, 81, 9, "#c6c4b9");
        rect(c, x + 12, y + 9, 58, 16, "#9b96ae");
        rect(c, x + 26, y + 25, 28, 18, "#817b99");
      }
    }
  };
})();
