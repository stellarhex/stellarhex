const page = document.body?.dataset.page;

if (page)
  for (const link of document.querySelectorAll(".nav__link[data-nav]"))
    if (link.dataset.nav === page) link.setAttribute("aria-current", "page");
